import { TILE_SIZE } from './Maze.js';

export class Enemy {
  constructor(scene, maze, startR, startC, id = 1) {
    this.scene = scene;
    this.maze = maze;
    this.id = id;

    this.r = startR;
    this.c = startC;
    const startPos = maze.getTileCenter(startR, startC);
    this.x = startPos.x;
    this.y = startPos.y;

    this.nextTile = null;
    this.speed = 85; // slower than player so it doesn't instantly overwhelm
    this.currentPath = [];
    this.pathTimer = 0;

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

    // Red surveillance eye
    this.chassis.fillStyle(0xff2bd6, 1);
    this.chassis.fillCircle(0, 0, 2);
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
  }

  update(delta, playerR, playerC) {
    const dt = delta / 1000;
    this.pathTimer += delta;

    // Recalculate patrol / pursuit path periodically (every 1.5s)
    if (this.pathTimer > 1500 || this.currentPath.length === 0) {
      this.pathTimer = 0;
      this.planPath(playerR, playerC);
    }

    if (this.nextTile) {
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
    } else if (this.currentPath && this.currentPath.length > 0) {
      const step = this.currentPath.shift();
      if (this.maze.isWalkable(step.r, step.c)) {
        this.nextTile = step;
      }
    }

    this.container.setPosition(this.x, this.y);
  }

  planPath(playerR, playerC) {
    // 60% chance to path toward player; 40% chance to roam corridors
    if (Math.random() < 0.6) {
      const p = this.maze.findPath(this.r, this.c, playerR, playerC);
      if (p && p.length > 0) {
        this.currentPath = p;
        return;
      }
    }

    // Roam to a random open tile nearby
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
      const choice = valid[Math.floor(Math.random() * valid.length)];
      this.currentPath = [choice];
    }
  }

  destroy() {
    this.container.destroy();
  }
}
