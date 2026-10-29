import Phaser from 'phaser';
import { Maze, TILE_SIZE, GRID_COLS, GRID_ROWS } from './Maze.js';
import { Player } from './Player.js';
import { Enemy } from './Enemy.js';
import { ObstacleManager } from './ObstacleManager.js';
import { ParticleEffects } from './ParticleEffects.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });

    this.maze = null;
    this.player = null;
    this.enemies = [];
    this.obstacleManager = null;
    this.particleEffects = null;

    this.collectibles = [];
    this.powerups = [];
    this.powerupTimer = 0;

    this.invulnerabilityTimer = 0;
    this.isRunActive = false;
    this.isScenePaused = false;
    this.timeRemaining = 120;
    this.totalDuration = 120;

    // External event hooks connected by UI
    this.externalCallbacks = {};
  }

  setCallbacks(callbacks) {
    this.externalCallbacks = callbacks;
  }

  setTimeRemaining(remaining, total = 120) {
    this.timeRemaining = Math.max(0, remaining);
    this.totalDuration = total || 120;
  }

  getValidSpawnPosition(preferredR, preferredC, excludedPositions = []) {
    if (
      this.maze.isWalkable(preferredR, preferredC) &&
      !excludedPositions.some(p => p.r === preferredR && p.c === preferredC)
    ) {
      return { r: preferredR, c: preferredC };
    }
    const nearest = this.maze.findNearestTarget(preferredR, preferredC, (r, c) => {
      return (
        this.maze.isWalkable(r, c) &&
        !excludedPositions.some(p => p.r === r && p.c === c)
      );
    });
    return nearest || { r: preferredR, c: preferredC };
  }

  create() {
    // Background cyber grid lines
    this.createBackgroundGrid();

    // 1. Initialize Maze
    this.maze = new Maze(this);
    this.maze.renderWalls();

    // 2. Initialize Particles & Obstacles
    this.particleEffects = new ParticleEffects(this);
    this.obstacleManager = new ObstacleManager(this, this.maze);

    // 3. Initialize Collectible Data Fragments
    this.initCollectibles();

    // 4. Initialize Player at tile (1, 1)
    this.player = new Player(this, this.maze, 1, 1);

    // 5. Initialize AI Hunter Drones
    this.initEnemies();
  }

  createBackgroundGrid() {
    const bg = this.add.graphics();
    bg.setDepth(1);
    bg.lineStyle(1, 0x00f5ff, 0.05);

    const w = GRID_COLS * TILE_SIZE;
    const h = GRID_ROWS * TILE_SIZE;

    for (let x = 0; x <= w; x += TILE_SIZE) {
      bg.lineBetween(x, 0, x, h);
    }
    for (let y = 0; y <= h; y += TILE_SIZE) {
      bg.lineBetween(0, y, w, y);
    }
  }

  initCollectibles() {
    this.collectibles = [];
    const validCorridors = [];

    for (let r = 1; r < this.maze.rows - 1; r++) {
      for (let c = 1; c < this.maze.cols - 1; c++) {
        // Exclude player start and enemy spawns
        const isExcluded = (r === 1 && c === 1) ||
                           (r === 7 && c === 10) ||
                           (r === 1 && c === 19) ||
                           (r === 13 && c === 19);
        if (this.maze.isWalkable(r, c) && !isExcluded) {
          validCorridors.push({ r, c });
        }
      }
    }

    // Shuffle and pick 18 nodes for floating data fragments
    this.shuffle(validCorridors);
    const chosen = validCorridors.slice(0, 18);

    chosen.forEach(({ r, c }, idx) => {
      const pos = this.maze.getTileCenter(r, c);
      const gfx = this.add.graphics();
      gfx.setDepth(4);

      // Rotating diamond
      gfx.fillStyle(0x00f5ff, 0.9);
      gfx.beginPath();
      gfx.moveTo(0, -5);
      gfx.lineTo(5, 0);
      gfx.lineTo(0, 5);
      gfx.lineTo(-5, 0);
      gfx.closePath();
      gfx.fillPath();
      gfx.setPosition(pos.x, pos.y);

      // Pulse tween
      this.tweens.add({
        targets: gfx,
        scaleX: 1.3,
        scaleY: 1.3,
        duration: 450 + (idx % 4) * 80,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      this.collectibles.push({
        id: `frag_${idx}_${r}_${c}`,
        r,
        c,
        x: pos.x,
        y: pos.y,
        gfx,
        active: true,
        collected: false
      });
    });
  }

  initEnemies() {
    this.enemies.forEach(e => e.destroy());
    this.enemies = [];

    // 3 enemies present from the very beginning at separate valid positions
    const spawnCandidates = [
      { r: 7, c: 10, role: 'hunter' },       // Central intersection
      { r: 1, c: 19, role: 'interceptor' },  // Top-right corridor
      { r: 13, c: 19, role: 'flanker' }      // Bottom-right corridor
    ];

    const occupied = [{ r: 1, c: 1 }]; // Exclude player start position

    spawnCandidates.forEach((candidate, idx) => {
      const pos = this.getValidSpawnPosition(candidate.r, candidate.c, occupied);
      occupied.push(pos);
      const enemy = new Enemy(this, this.maze, pos.r, pos.c, idx + 1, candidate.role);
      this.enemies.push(enemy);
    });
  }

  addSecondEnemy() {
    // 3 enemies are already active from start; maintain safe no-op
    if (this.enemies.length >= 3) return;
  }

  startRun() {
    this.isRunActive = true;
    this.isScenePaused = false;
    this.invulnerabilityTimer = 0;
    this.powerupTimer = 0;
    this.timeRemaining = 120;
    this.totalDuration = 120;

    this.obstacleManager.reset();
    this.maze.renderWalls();
    this.player.reset(1, 1);
    this.initEnemies();
    this.initCollectibles();
  }

  pauseRun() {
    this.isScenePaused = true;
  }

  resumeRun() {
    this.isScenePaused = false;
  }

  stopRun() {
    this.isRunActive = false;
  }

  triggerObstacleSpawn() {
    if (!this.obstacleManager || !this.player) return;
    this.obstacleManager.spawnObstacle(this.player.r, this.player.c, (r, c, type) => {
      // Re-route player immediately around the new hazard
      this.player.recalculatePath(this.collectibles, this.powerups);
      if (this.externalCallbacks.onObstacleSpawned) {
        this.externalCallbacks.onObstacleSpawned({ r, c, type });
      }
    });
  }

  spawnPowerUp() {
    // Pick an empty open corridor far from player
    const valid = [];
    for (let r = 1; r < this.maze.rows - 1; r++) {
      for (let c = 1; c < this.maze.cols - 1; c++) {
        if (
          this.maze.isWalkable(r, c) &&
          Math.hypot(r - this.player.r, c - this.player.c) >= 4 &&
          !this.collectibles.some(col => col.active && col.r === r && col.c === c) &&
          !this.powerups.some(pu => pu.active && pu.r === r && pu.c === c)
        ) {
          valid.push({ r, c });
        }
      }
    }

    if (valid.length === 0) return;
    const picked = valid[Math.floor(Math.random() * valid.length)];

    const types = [
      { id: 'shield', color: 0x00f5ff, symbol: '🛡️', label: 'SHIELD' },
      { id: 'debug', color: 0xffaa00, symbol: '⚡', label: 'DEBUG' },
      { id: 'restore', color: 0x39ff88, symbol: '💖', label: 'RESTORE' },
      { id: 'overclock', color: 0xff2bd6, symbol: '🚀', label: 'OVERCLOCK' }
    ];

    const chosenType = types[Math.floor(Math.random() * types.length)];
    const pos = this.maze.getTileCenter(picked.r, picked.c);

    const container = this.add.container(pos.x, pos.y);
    container.setDepth(5);

    const halo = this.add.circle(0, 0, 14, chosenType.color, 0.3);
    container.add(halo);

    const ring = this.add.circle(0, 0, 11);
    ring.setStrokeStyle(1.5, chosenType.color);
    container.add(ring);

    const icon = this.add.text(0, 0, chosenType.symbol, { fontSize: '13px' }).setOrigin(0.5);
    container.add(icon);

    this.tweens.add({
      targets: halo,
      scaleX: 1.4,
      scaleY: 1.4,
      alpha: 0.1,
      duration: 600,
      yoyo: true,
      repeat: -1
    });

    const pu = {
      r: picked.r,
      c: picked.c,
      x: pos.x,
      y: pos.y,
      type: chosenType.id,
      label: chosenType.label,
      color: chosenType.color,
      container,
      active: true
    };

    this.powerups.push(pu);

    // Re-route player if closest target
    this.player.recalculatePath(this.collectibles, this.powerups);
  }

  update(time, delta) {
    if (!this.isRunActive || this.isScenePaused) return;

    if (this.invulnerabilityTimer > 0) {
      this.invulnerabilityTimer -= delta;
    }

    // Powerup spawner loop (every 22 seconds)
    this.powerupTimer += delta;
    if (this.powerupTimer > 22000) {
      this.powerupTimer = 0;
      if (this.powerups.filter(p => p.active).length < 2) {
        this.spawnPowerUp();
      }
    }

    // Smooth progress calculation from timeRemaining (0.0 to 1.0)
    const progress = Math.min(1.0, Math.max(0.0, 1 - (this.timeRemaining / this.totalDuration)));

    // Update Player automatic navigation
    this.player.update(delta, this.collectibles, this.powerups, this.obstacleManager.activeObstacles);

    // Update Enemies with dynamic pursuit scaling & safe distance tracking
    const playerPos = {
      x: this.player.x,
      y: this.player.y,
      r: this.player.r,
      c: this.player.c,
      heading: this.player.heading
    };

    this.enemies.forEach(enemy => {
      enemy.update(delta, this.player.r, this.player.c, this.player.heading, progress, this.enemies, playerPos);
    });

    // Check Player collisions with Collectibles
    this.checkCollectibleCollisions();

    // Check Player collisions with Powerups
    this.checkPowerupCollisions();

    // Check Player collisions with Enemies
    this.checkEnemyCollisions();
  }

  checkCollectibleCollisions() {
    for (const col of this.collectibles) {
      if (col.active && !col.collected) {
        const dist = Math.hypot(this.player.x - col.x, this.player.y - col.y);
        if (dist < 14) {
          col.active = false;
          col.collected = true;
          col.gfx.setVisible(false);

          // Particles & Sound
          this.particleEffects.emitFragmentCollect(col.x, col.y);
          this.particleEffects.spawnScoreFloater(col.x, col.y, '+25');

          if (this.externalCallbacks.onFragmentCollected) {
            this.externalCallbacks.onFragmentCollected(col.id);
          }
        }
      }
    }
  }

  respawnCollectible(col) {
    const valid = [];
    for (let r = 1; r < this.maze.rows - 1; r++) {
      for (let c = 1; c < this.maze.cols - 1; c++) {
        if (
          this.maze.isWalkable(r, c) &&
          !this.collectibles.some(other => other.active && other.r === r && other.c === c)
        ) {
          valid.push({ r, c });
        }
      }
    }
    if (valid.length > 0) {
      const picked = valid[Math.floor(Math.random() * valid.length)];
      const pos = this.maze.getTileCenter(picked.r, picked.c);
      col.r = picked.r;
      col.c = picked.c;
      col.x = pos.x;
      col.y = pos.y;
      col.gfx.setPosition(pos.x, pos.y);
      col.gfx.setVisible(true);
      col.active = true;
    }
  }

  checkPowerupCollisions() {
    for (const pu of this.powerups) {
      if (pu.active) {
        const dist = Math.hypot(this.player.x - pu.x, this.player.y - pu.y);
        if (dist < 16) {
          pu.active = false;
          pu.container.destroy();

          this.particleEffects.emitPowerupCollect(pu.x, pu.y, pu.color);
          this.particleEffects.spawnScoreFloater(pu.x, pu.y, pu.label, '#39ff88');

          // Handle special effects
          if (pu.type === 'debug') {
            this.obstacleManager.clearOneObstacle();
            this.player.recalculatePath(this.collectibles, this.powerups);
          }

          if (this.externalCallbacks.onPowerupCollected) {
            this.externalCallbacks.onPowerupCollected(pu.type);
          }
        }
      }
    }
  }

  // Proximity detection for question timeouts
  getEnemiesInDangerRadius(dangerRadius = 75) {
    if (!this.player || !this.enemies || this.enemies.length === 0) return [];
    return this.enemies.filter(enemy => {
      const dist = Math.hypot(this.player.x - enemy.x, this.player.y - enemy.y);
      return dist <= dangerRadius;
    });
  }

  isAnyEnemyInDangerRadius(dangerRadius = 75) {
    return this.getEnemiesInDangerRadius(dangerRadius).length > 0;
  }

  checkEnemyCollisions() {
    if (!this.player || !this.enemies || this.invulnerabilityTimer > 0) return;

    for (const enemy of this.enemies) {
      const dist = Math.hypot(this.player.x - enemy.x, this.player.y - enemy.y);
      if (dist < 22) {
        this.invulnerabilityTimer = 1500; // 1.5s invulnerability cooldown
        if (this.cameras && this.cameras.main) {
          this.cameras.main.shake(250, 0.015);
        }
        if (this.particleEffects) {
          this.particleEffects.emitDamageGlitch(this.player.x, this.player.y);
        }
        if (this.externalCallbacks.onEnemyCollision) {
          this.externalCallbacks.onEnemyCollision();
        }
        break;
      }
    }
  }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}
