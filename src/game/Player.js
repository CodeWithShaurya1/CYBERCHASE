import { TILE_SIZE } from './Maze.js';

export class Player {
  constructor(scene, maze, startR = 1, startC = 1) {
    this.scene = scene;
    this.maze = maze;

    this.r = startR;
    this.c = startC;
    const startPos = maze.getTileCenter(startR, startC);
    this.x = startPos.x;
    this.y = startPos.y;

    this.targetR = startR;
    this.targetC = startC;
    this.nextTile = null;
    this.currentPath = [];

    // Movement speeds
    this.baseSpeed = 120; // pixels per second
    this.speedMultiplier = 1.0;

    // Visual elements container
    this.container = scene.add.container(this.x, this.y);
    this.container.setDepth(10);

    // Directional halo
    this.halo = scene.add.graphics();
    this.halo.fillStyle(0x00f5ff, 0.2);
    this.halo.fillCircle(0, 0, 18);
    this.container.add(this.halo);

    // Cyber core
    this.core = scene.add.graphics();
    this.renderCore();
    this.container.add(this.core);

    // Shield bubble (visible when shield active)
    this.shieldGfx = scene.add.graphics();
    this.shieldGfx.lineStyle(2.5, 0x00f5ff, 0.9);
    this.shieldGfx.strokeCircle(0, 0, 20);
    this.shieldGfx.fillStyle(0x00f5ff, 0.15);
    this.shieldGfx.fillCircle(0, 0, 20);
    this.shieldGfx.setVisible(false);
    this.container.add(this.shieldGfx);

    // Heading direction
    this.heading = { x: 1, y: 0 };
    this.lastTargetObj = null;

    // Trail timer
    this.trailTimer = 0;

    // Idle pulse tween
    scene.tweens.add({
      targets: this.halo,
      scaleX: 1.25,
      scaleY: 1.25,
      alpha: 0.1,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  renderCore() {
    this.core.clear();
    // Cyber circle with chevron
    this.core.fillStyle(0x00f5ff, 1);
    this.core.fillCircle(0, 0, 9);

    // Electric purple inner node
    this.core.fillStyle(0x9d4edd, 1);
    this.core.fillCircle(0, 0, 5);

    // Bright white center data eye
    this.core.fillStyle(0xffffff, 1);
    this.core.fillCircle(0, 0, 2.5);
  }

  setSpeedMultiplier(mult) {
    this.speedMultiplier = Math.max(1.0, mult);
  }

  setShieldVisible(visible) {
    this.shieldGfx.setVisible(visible);
    if (visible) {
      this.scene.tweens.add({
        targets: this.shieldGfx,
        rotation: Math.PI * 2,
        duration: 2000,
        repeat: -1
      });
    }
  }

  triggerBoostEffect() {
    // Glow burst on correct answer
    const flash = this.scene.add.circle(this.container.x, this.container.y, 24, 0x39ff88, 0.8);
    flash.setDepth(9);
    this.scene.tweens.add({
      targets: flash,
      scale: 2.2,
      alpha: 0,
      duration: 350,
      ease: 'Power2',
      onComplete: () => flash.destroy()
    });
  }

  reset(startR = 1, startC = 1) {
    this.r = startR;
    this.c = startC;
    const startPos = this.maze.getTileCenter(startR, startC);
    this.x = startPos.x;
    this.y = startPos.y;
    this.container.setPosition(this.x, this.y);
    this.targetR = startR;
    this.targetC = startC;
    this.nextTile = null;
    this.currentPath = [];
    this.speedMultiplier = 1.0;
    this.setShieldVisible(false);
  }

  update(delta, collectibles, powerups, obstacles) {
    const dt = delta / 1000;

    // Trail generation
    this.trailTimer += delta;
    if (this.trailTimer > 60) {
      this.trailTimer = 0;
      this.spawnTrailGhost();
    }

    // If currently between tiles, interpolate toward nextTile
    if (this.nextTile) {
      const destPos = this.maze.getTileCenter(this.nextTile.r, this.nextTile.c);
      const dx = destPos.x - this.x;
      const dy = destPos.y - this.y;
      const dist = Math.hypot(dx, dy);

      const moveStep = this.baseSpeed * this.speedMultiplier * dt;

      if (dist <= moveStep) {
        // Reached destination tile
        this.x = destPos.x;
        this.y = destPos.y;
        this.r = this.nextTile.r;
        this.c = this.nextTile.c;
        this.nextTile = null;

        // Tunnel wrap
        if (this.r === 7) {
          if (this.c <= 0 && this.heading.x < 0) {
            this.c = this.maze.cols - 1;
            const wrapPos = this.maze.getTileCenter(this.r, this.c);
            this.x = wrapPos.x;
            this.y = wrapPos.y;
          } else if (this.c >= this.maze.cols - 1 && this.heading.x > 0) {
            this.c = 0;
            const wrapPos = this.maze.getTileCenter(this.r, this.c);
            this.x = wrapPos.x;
            this.y = wrapPos.y;
          }
        }
      } else {
        // Move towards next tile
        this.heading.x = dx / dist;
        this.heading.y = dy / dist;
        this.x += this.heading.x * moveStep;
        this.y += this.heading.y * moveStep;
      }
    } else {
      // Need a new path or next step
      this.advancePath(collectibles, powerups);
    }

    this.container.setPosition(this.x, this.y);
  }

  spawnTrailGhost() {
    const ghost = this.scene.add.circle(this.x, this.y, 6, 0x00f5ff, 0.4);
    ghost.setDepth(8);
    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      scale: 0.2,
      duration: 250,
      onComplete: () => ghost.destroy()
    });
  }

  advancePath(collectibles, powerups) {
    // If path is empty, find nearest collectible or powerup
    if (!this.currentPath || this.currentPath.length === 0) {
      this.planPathToTarget(collectibles, powerups);
    }

    if (this.currentPath && this.currentPath.length > 0) {
      const step = this.currentPath.shift();
      // Ensure step is still walkable (could have been blocked by a new dynamic obstacle)
      if (this.maze.isWalkable(step.r, step.c)) {
        this.nextTile = step;
        return;
      } else {
        // Obstacle blocked current route, recalculate immediately!
        this.currentPath = [];
        this.planPathToTarget(collectibles, powerups);
        if (this.currentPath && this.currentPath.length > 0) {
          const retryStep = this.currentPath.shift();
          if (this.maze.isWalkable(retryStep.r, retryStep.c)) {
            this.nextTile = retryStep;
            return;
          }
        }
      }
    }

    // Safety fallback: if target is unreachable or path is empty, continue roaming open corridor
    const dirs = [
      { r: Math.round(this.heading.y) || 0, c: Math.round(this.heading.x) || 0 }, // straight
      { r: 0, c: 1 }, { r: 1, c: 0 }, { r: 0, c: -1 }, { r: -1, c: 0 }
    ];

    for (const d of dirs) {
      if (d.r === 0 && d.c === 0) continue;
      const nr = this.r + d.r;
      let nc = this.c + d.c;
      if (nr === 7) {
        if (nc < 0) nc = this.maze.cols - 1;
        else if (nc >= this.maze.cols) nc = 0;
      }
      if (this.maze.isWalkable(nr, nc)) {
        this.nextTile = { r: nr, c: nc };
        this.currentPath = [];
        return;
      }
    }
  }

  planPathToTarget(collectibles, powerups) {
    // Priority: Reachable active power-up first, else nearest collectible data fragment
    let target = null;

    if (powerups && powerups.length > 0) {
      for (const p of powerups) {
        if (p.active) {
          const path = this.maze.findPath(this.r, this.c, p.r, p.c);
          if (path && path.length > 0) {
            target = { r: p.r, c: p.c, path };
            break;
          }
        }
      }
    }

    if (!target && collectibles && collectibles.length > 0) {
      // Find nearest active collectible via BFS
      const nearest = this.maze.findNearestTarget(this.r, this.c, (r, c) => {
        return collectibles.some(col => col.active && col.r === r && col.c === c);
      });

      if (nearest) {
        const path = this.maze.findPath(this.r, this.c, nearest.r, nearest.c);
        if (path && path.length > 0) {
          target = { r: nearest.r, c: nearest.c, path };
        }
      }
    }

    // Fallback: roam to any valid neighboring open corridor
    if (!target) {
      const dr = [-1, 1, 0, 0];
      const dc = [0, 0, -1, 1];
      for (let i = 0; i < 4; i++) {
        const nr = this.r + dr[i];
        const nc = this.c + dc[i];
        if (this.maze.isWalkable(nr, nc)) {
          this.currentPath = [{ r: nr, c: nc }];
          return;
        }
      }
    } else {
      this.currentPath = target.path;
    }
  }

  // Force recalculate navigation path (e.g., after an obstacle spawns)
  recalculatePath(collectibles, powerups) {
    this.currentPath = [];
    this.planPathToTarget(collectibles, powerups);
  }
}
