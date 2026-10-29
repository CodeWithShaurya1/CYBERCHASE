import { TILE_SIZE } from './Maze.js';

export class ObstacleManager {
  constructor(scene, maze) {
    this.scene = scene;
    this.maze = maze;
    this.activeObstacles = [];
    this.warningIndicators = [];
  }

  reset() {
    this.activeObstacles.forEach(obs => {
      if (obs.container) obs.container.destroy();
    });
    this.warningIndicators.forEach(w => {
      if (w) w.destroy();
    });
    this.activeObstacles = [];
    this.warningIndicators = [];
    this.maze.dynamicObstacles.clear();
  }

  // Attempt to spawn an obstacle safely
  spawnObstacle(playerR, playerC, onObstacleActivated) {
    // Collect candidates in corridors away from player (at least 3 tiles away)
    const candidates = [];
    for (let r = 1; r < this.maze.rows - 1; r++) {
      for (let c = 1; c < this.maze.cols - 1; c++) {
        const dist = Math.hypot(r - playerR, c - playerC);
        if (dist >= 3 && this.maze.canPlaceObstacle(r, c, playerR, playerC)) {
          candidates.push({ r, c, dist });
        }
      }
    }

    if (candidates.length === 0) return null;

    // Pick a candidate
    candidates.sort((a, b) => a.dist - b.dist);
    // Pick from closest 5 candidates to make it impactful without blocking player
    const pool = candidates.slice(0, Math.min(5, candidates.length));
    const picked = pool[Math.floor(Math.random() * pool.length)];

    const types = ['firewall', 'glitch_block', 'laser_grid'];
    const type = types[Math.floor(Math.random() * types.length)];

    const center = this.maze.getTileCenter(picked.r, picked.c);

    // 1. Telegraph warning indicator (1.2 seconds flashing warning)
    const warning = this.scene.add.container(center.x, center.y);
    warning.setDepth(6);

    const warnGfx = this.scene.add.graphics();
    warnGfx.lineStyle(2, 0xff3355, 1);
    warnGfx.strokeRect(-TILE_SIZE / 2 + 2, -TILE_SIZE / 2 + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    warnGfx.fillStyle(0xff3355, 0.3);
    warnGfx.fillRect(-TILE_SIZE / 2 + 2, -TILE_SIZE / 2 + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    warning.add(warnGfx);

    const warnText = this.scene.add.text(0, 0, '⚠️', { fontSize: '14px' }).setOrigin(0.5);
    warning.add(warnText);

    this.warningIndicators.push(warning);

    // Flash animation
    this.scene.tweens.add({
      targets: warning,
      alpha: 0.2,
      duration: 200,
      yoyo: true,
      repeat: 4,
      onComplete: () => {
        // Destroy warning indicator
        warning.destroy();
        const wIdx = this.warningIndicators.indexOf(warning);
        if (wIdx !== -1) this.warningIndicators.splice(wIdx, 1);

        // Verify player didn't just walk onto this tile during the 1.2s warning
        if (picked.r === playerR && picked.c === playerC) {
          return;
        }

        // 2. Activate physical obstacle
        this.activateObstacle(picked.r, picked.c, type);
        if (onObstacleActivated) onObstacleActivated(picked.r, picked.c, type);
      }
    });

    return { r: picked.r, c: picked.c, type };
  }

  activateObstacle(r, c, type) {
    // Register in maze dynamic obstacles map
    this.maze.dynamicObstacles.set(`${r},${c}`, { type });

    const center = this.maze.getTileCenter(r, c);
    const container = this.scene.add.container(center.x, center.y);
    container.setDepth(7);

    const gfx = this.scene.add.graphics();

    if (type === 'firewall') {
      // Flaming red/orange security gate
      gfx.fillStyle(0xff3355, 0.95);
      gfx.fillRoundedRect(-TILE_SIZE / 2 + 2, -TILE_SIZE / 2 + 2, TILE_SIZE - 4, TILE_SIZE - 4, 3);
      gfx.lineStyle(2, 0xff9900, 1);
      gfx.strokeRoundedRect(-TILE_SIZE / 2 + 2, -TILE_SIZE / 2 + 2, TILE_SIZE - 4, TILE_SIZE - 4, 3);
      // Warning stripes
      gfx.lineStyle(1.5, 0xffffff, 0.7);
      gfx.lineBetween(-10, -10, 10, 10);
      gfx.lineBetween(-10, 10, 10, -10);
    } else if (type === 'glitch_block') {
      // Corrupted purple glitch block
      gfx.fillStyle(0x9d4edd, 0.95);
      gfx.fillRoundedRect(-TILE_SIZE / 2 + 2, -TILE_SIZE / 2 + 2, TILE_SIZE - 4, TILE_SIZE - 4, 2);
      gfx.lineStyle(2, 0xff2bd6, 1);
      gfx.strokeRoundedRect(-TILE_SIZE / 2 + 2, -TILE_SIZE / 2 + 2, TILE_SIZE - 4, TILE_SIZE - 4, 2);
    } else {
      // Pulsing laser grid
      gfx.fillStyle(0x0b1020, 0.9);
      gfx.fillRect(-TILE_SIZE / 2 + 2, -TILE_SIZE / 2 + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      gfx.lineStyle(2, 0x00f5ff, 1);
      gfx.lineBetween(-12, -6, 12, -6);
      gfx.lineBetween(-12, 6, 12, 6);
    }

    container.add(gfx);

    // Subtle idle animation
    this.scene.tweens.add({
      targets: container,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    const obs = { r, c, type, container };
    this.activeObstacles.push(obs);
    return obs;
  }

  // Clear one obstacle (used by DEBUG power-up)
  clearOneObstacle() {
    if (this.activeObstacles.length === 0) return false;
    const obs = this.activeObstacles.pop();
    this.maze.dynamicObstacles.delete(`${obs.r},${obs.c}`);
    if (obs.container) {
      // Disintegrate animation
      this.scene.tweens.add({
        targets: obs.container,
        scale: 0.1,
        alpha: 0,
        duration: 300,
        onComplete: () => obs.container.destroy()
      });
    }
    return true;
  }

  hasActiveObstacles() {
    return this.activeObstacles.length > 0;
  }
}
