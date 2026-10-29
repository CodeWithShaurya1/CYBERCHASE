import { TILE_SIZE } from './Maze.js';

export class Enemy {
  constructor(scene, maze, startR, startC, id = 1, role = 'hunter') {
    this.scene = scene;
    this.maze = maze;
    this.id = id;
    this.role = role;

    this.r = startR;
    this.c = startC;
    const startPos = maze.getTileCenter(startR, startC);
    this.x = startPos.x;
    this.y = startPos.y;

    this.nextTile = null;
    this.currentPath = [];
    this.pathTimer = 0;
    this.gameProgress = 0; // 0.0 at game start -> 1.0 when time expires

    // Role-specific speeds and visuals
    // Player base speed is 120 px/s; enemies scale smoothly from manageable to aggressive
    switch (role) {
      case 'interceptor':
        this.minSpeed = 72;
        this.maxSpeed = 114;
        this.eyeColor = 0xffaa00; // Neon Cyber Orange
        break;
      case 'flanker':
        this.minSpeed = 78;
        this.maxSpeed = 122;
        this.eyeColor = 0x9d4edd; // Neon Electric Purple
        break;
      case 'hunter':
      default:
        this.minSpeed = 75;
        this.maxSpeed = 118;
        this.eyeColor = 0xff2bd6; // Neon Magenta
        break;
    }

    this.speed = this.minSpeed;

    // Visuals
    this.container = scene.add.container(this.x, this.y);
    this.container.setDepth(9);

    // Threat radius aura
    this.aura = scene.add.graphics();
    this.aura.fillStyle(0xff3355, 0.15);
    this.aura.fillCircle(0, 0, 22);
    this.container.add(this.aura);

    // Drone chassis
    this.chassis = scene.add.graphics();
    this.renderChassis();
    this.container.add(this.chassis);

    // Threat pulsing animation
    scene.tweens.add({
      targets: this.aura,
      scaleX: 1.3,
      scaleY: 1.3,
      alpha: 0.05,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  renderChassis() {
    this.chassis.clear();
    // Diamond drone body
    this.chassis.fillStyle(0xff3355, 1);
    this.chassis.beginPath();
    this.chassis.moveTo(0, -9);
    this.chassis.lineTo(9, 0);
    this.chassis.lineTo(0, 9);
    this.chassis.lineTo(-9, 0);
    this.chassis.closePath();
    this.chassis.fillPath();

    // Inner dark cyber core
    this.chassis.fillStyle(0x050611, 1);
    this.chassis.fillCircle(0, 0, 4);

    // Surveillance eye styled with role color
    this.chassis.fillStyle(this.eyeColor, 1);
    this.chassis.fillCircle(0, 0, 2.2);
  }

  reset(startR, startC) {
    this.r = startR;
    this.c = startC;
    const pos = this.maze.getTileCenter(startR, startC);
    this.x = pos.x;
    this.y = pos.y;
    this.container.setPosition(this.x, this.y);
    this.nextTile = null;
    this.currentPath = [];
    this.pathTimer = 0;
    this.gameProgress = 0;
    this.speed = this.minSpeed;
  }

  setGameProgress(progress) {
    this.gameProgress = Math.max(0, Math.min(1, progress));
    // Smooth speed scaling from early to late game
    this.speed = this.minSpeed + (this.maxSpeed - this.minSpeed) * this.gameProgress;
  }

  update(delta, playerR, playerC, playerHeading = { x: 1, y: 0 }, progress = 0, allEnemies = []) {
    const dt = delta / 1000;
    this.setGameProgress(progress);

    // Dynamic replan frequency: early game replans every 1400ms, late game every 500ms
    const replanInterval = 1400 - (900 * this.gameProgress);
    this.pathTimer += delta;

    if (this.pathTimer > replanInterval || !this.currentPath || this.currentPath.length === 0) {
      this.pathTimer = 0;
      this.planPath(playerR, playerC, playerHeading, allEnemies);
    }

    if (this.nextTile) {
      // Re-verify nextTile is walkable in case a dynamic obstacle spawned
      if (!this.maze.isWalkable(this.nextTile.r, this.nextTile.c)) {
        this.nextTile = null;
        this.currentPath = [];
        this.planPath(playerR, playerC, playerHeading, allEnemies);
      } else {
        const destPos = this.maze.getTileCenter(this.nextTile.r, this.nextTile.c);
        const dx = destPos.x - this.x;
        const dy = destPos.y - this.y;
        const dist = Math.hypot(dx, dy);

        const moveStep = this.speed * dt;

        if (dist <= moveStep) {
          this.x = destPos.x;
          this.y = destPos.y;
          this.r = this.nextTile.r;
          this.c = this.nextTile.c;
          this.nextTile = null;
        } else {
          this.x += (dx / dist) * moveStep;
          this.y += (dy / dist) * moveStep;
        }
      }
    } else if (this.currentPath && this.currentPath.length > 0) {
      const step = this.currentPath.shift();
      if (this.maze.isWalkable(step.r, step.c)) {
        this.nextTile = step;
      } else {
        this.currentPath = [];
      }
    }

    // Separation nudge: prevent enemies from overlapping tightly
    if (allEnemies && allEnemies.length > 1) {
      for (const other of allEnemies) {
        if (other && other !== this) {
          const sepX = this.x - other.x;
          const sepY = this.y - other.y;
          const sepDist = Math.hypot(sepX, sepY);
          if (sepDist > 0 && sepDist < 16) {
            const push = (16 - sepDist) * 0.05;
            const newX = this.x + (sepX / sepDist) * push;
            const newY = this.y + (sepY / sepDist) * push;
            const tile = this.maze.worldToTile(newX, newY);
            if (this.maze.isWalkable(tile.r, tile.c)) {
              this.x = newX;
              this.y = newY;
            }
          }
        }
      }
    }

    this.container.setPosition(this.x, this.y);
  }

  planPath(playerR, playerC, playerHeading = { x: 1, y: 0 }, allEnemies = []) {
    // Dynamic chase chance: 50% early game -> ~74% mid-game -> ~98% late game
    const chaseChance = 0.50 + 0.48 * this.gameProgress;
    const shouldChase = Math.random() < chaseChance;

    if (shouldChase) {
      let targetR = playerR;
      let targetC = playerC;

      // Role behaviors:
      if (this.role === 'interceptor' && this.gameProgress >= 0.25) {
        // Attempt to intercept 2-3 tiles ahead of player's heading
        const lead = this.gameProgress >= 0.65 ? 3 : 2;
        const hx = playerHeading ? Math.sign(playerHeading.x || 0) : 0;
        const hy = playerHeading ? Math.sign(playerHeading.y || 0) : 0;
        const aheadR = playerR + hy * lead;
        const aheadC = playerC + hx * lead;

        if (this.maze.isWalkable(aheadR, aheadC)) {
          targetR = aheadR;
          targetC = aheadC;
        }
      } else if (this.role === 'flanker' && this.gameProgress >= 0.35) {
        // Attempt to pinch from a perpendicular corridor
        const hx = playerHeading ? Math.sign(playerHeading.x || 0) : 0;
        const hy = playerHeading ? Math.sign(playerHeading.y || 0) : 0;
        const flankR = playerR + (hx !== 0 ? 2 : 0);
        const flankC = playerC + (hy !== 0 ? 2 : 0);

        if (this.maze.isWalkable(flankR, flankC)) {
          targetR = flankR;
          targetC = flankC;
        }
      }

      const p = this.maze.findPath(this.r, this.c, targetR, targetC);
      if (p && p.length > 0) {
        this.currentPath = p;
        return;
      }

      // Fallback: direct shortest path to player
      const direct = this.maze.findPath(this.r, this.c, playerR, playerC);
      if (direct && direct.length > 0) {
        this.currentPath = direct;
        return;
      }
    }

    // Roam corridors while progressively bias-drifting closer to player
    const dr = [-1, 1, 0, 0];
    const dc = [0, 0, -1, 1];
    const valid = [];
    for (let i = 0; i < 4; i++) {
      const nr = this.r + dr[i];
      const nc = this.c + dc[i];
      if (this.maze.isWalkable(nr, nc)) {
        valid.push({ r: nr, c: nc });
      }
    }

    if (valid.length > 0) {
      if (this.gameProgress < 0.3) {
        // Early game: random patrol roaming
        const choice = valid[Math.floor(Math.random() * valid.length)];
        this.currentPath = [choice];
      } else {
        // Mid to late game: prioritize corridors that reduce distance to player
        valid.sort((a, b) => {
          const distA = Math.hypot(a.r - playerR, a.c - playerC);
          const distB = Math.hypot(b.r - playerR, b.c - playerC);
          return distA - distB;
        });
        // 80% pick best distance-reducing tile, 20% second best for variety
        const pick = (Math.random() < 0.8 || valid.length === 1) ? valid[0] : valid[1];
        this.currentPath = [pick];
      }
    }
  }

  destroy() {
    if (this.container) {
      this.container.destroy();
    }
  }
}
