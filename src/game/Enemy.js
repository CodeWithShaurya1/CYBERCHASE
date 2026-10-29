import { TILE_SIZE } from './Maze.js';

export const ENEMY_DANGER_RADIUS = 75;

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
    this.hoverTime = 0;

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
    this.renderChassis(0, 0);
    this.container.add(this.chassis);

    // Threat pulsing animation
    this.auraTween = scene.tweens.add({
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

  renderChassis(eyeOffsetX = 0, eyeOffsetY = 0) {
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

    // Surveillance eye styled with role color, tracking the player
    this.chassis.fillStyle(this.eyeColor, 1);
    this.chassis.fillCircle(eyeOffsetX, eyeOffsetY, 2.2);
  }

  reset(startR, startC) {
    this.r = startR;
    this.c = startC;
    const pos = this.maze.getTileCenter(startR, startC);
    this.x = pos.x;
    this.y = pos.y;
    if (this.container) {
      this.container.setPosition(this.x, this.y);
    }
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

  // Minimum safe distance between enemy and player (tightens as game progresses, but never allows physical contact)
  getSafeDistance() {
    return Math.max(26, 42 - (14 * this.gameProgress));
  }

  update(delta, playerR, playerC, playerHeading = { x: 1, y: 0 }, progress = 0, allEnemies = [], playerPos = null) {
    const dt = delta / 1000;
    this.setGameProgress(progress);
    this.hoverTime += dt * 4;

    const pX = (playerPos && typeof playerPos.x === 'number')
      ? playerPos.x
      : this.maze.getTileCenter(playerR, playerC).x;
    const pY = (playerPos && typeof playerPos.y === 'number')
      ? playerPos.y
      : this.maze.getTileCenter(playerR, playerC).y;

    const safeDistance = this.getSafeDistance();
    let currentDistToPlayer = Math.hypot(this.x - pX, this.y - pY);

    // 1. Maintain Safe Distance: If player approaches enemy, step back along corridor to maintain safe distance barrier
    if (currentDistToPlayer > 0 && currentDistToPlayer < safeDistance) {
      const retreatDirX = (this.x - pX) / currentDistToPlayer;
      const retreatDirY = (this.y - pY) / currentDistToPlayer;
      const neededStep = safeDistance - currentDistToPlayer;
      const candX = this.x + retreatDirX * neededStep;
      const candY = this.y + retreatDirY * neededStep;
      const candTile = this.maze.worldToTile(candX, candY);
      if (this.maze.isWalkable(candTile.r, candTile.c)) {
        this.x = candX;
        this.y = candY;
        this.r = candTile.r;
        this.c = candTile.c;
        currentDistToPlayer = Math.hypot(this.x - pX, this.y - pY);
      }
    }

    // 2. Dynamic path replanning frequency: 1400ms early -> 450ms late game
    const replanInterval = 1400 - (950 * this.gameProgress);
    this.pathTimer += delta;

    if (this.pathTimer > replanInterval || !this.currentPath || this.currentPath.length === 0) {
      this.pathTimer = 0;
      this.planPath(playerR, playerC, playerHeading, allEnemies, pX, pY);
    }

    // 3. Movement execution with strict safe-distance protection
    if (this.nextTile) {
      if (!this.maze.isWalkable(this.nextTile.r, this.nextTile.c)) {
        this.nextTile = null;
        this.currentPath = [];
        this.planPath(playerR, playerC, playerHeading, allEnemies, pX, pY);
      } else {
        const destPos = this.maze.getTileCenter(this.nextTile.r, this.nextTile.c);
        const dx = destPos.x - this.x;
        const dy = destPos.y - this.y;
        const dist = Math.hypot(dx, dy);
        const moveStep = this.speed * dt;

        // Check distance to player after movement step
        const stepFraction = dist > 0 ? Math.min(1.0, moveStep / dist) : 0;
        const nextX = this.x + dx * stepFraction;
        const nextY = this.y + dy * stepFraction;
        const nextDistToPlayer = Math.hypot(nextX - pX, nextY - pY);

        if (nextDistToPlayer < safeDistance) {
          // Cannot advance all the way into safe zone
          if (currentDistToPlayer > safeDistance) {
            // Move partially up to safe distance boundary
            const allowedDist = Math.max(0, currentDistToPlayer - safeDistance);
            const actualMove = Math.min(moveStep, allowedDist);
            if (dist > 0 && actualMove > 0) {
              this.x += (dx / dist) * actualMove;
              this.y += (dy / dist) * actualMove;
            }
          } else {
            // Reached safe distance: clear direct tile and reposition or stalk
            this.nextTile = null;
            this.currentPath = [];
            this.repositionAroundPlayer(playerR, playerC, pX, pY, safeDistance);
          }
        } else {
          // Safe to advance along current path
          if (dist <= moveStep) {
            this.x = destPos.x;
            this.y = destPos.y;
            this.r = this.nextTile.r;
            this.c = this.nextTile.c;
            this.nextTile = null;
          } else {
            this.x = nextX;
            this.y = nextY;
          }
        }
      }
    } else if (this.currentPath && this.currentPath.length > 0) {
      const step = this.currentPath.shift();
      const stepPos = this.maze.getTileCenter(step.r, step.c);
      const stepDistToPlayer = Math.hypot(stepPos.x - pX, stepPos.y - pY);

      // Only take step if it doesn't move directly on top of the player
      if (this.maze.isWalkable(step.r, step.c) && (stepDistToPlayer >= safeDistance || currentDistToPlayer > safeDistance + 12)) {
        this.nextTile = step;
      } else {
        this.currentPath = [];
        this.repositionAroundPlayer(playerR, playerC, pX, pY, safeDistance);
      }
    }

    // 4. Mutual separation: prevent enemies from overlapping with each other
    if (allEnemies && allEnemies.length > 1) {
      for (const other of allEnemies) {
        if (other && other !== this) {
          const sepX = this.x - other.x;
          const sepY = this.y - other.y;
          const sepDist = Math.hypot(sepX, sepY);
          if (sepDist > 0 && sepDist < 18) {
            const push = (18 - sepDist) * 0.08;
            const candX = this.x + (sepX / sepDist) * push;
            const candY = this.y + (sepY / sepDist) * push;
            const tile = this.maze.worldToTile(candX, candY);
            if (this.maze.isWalkable(tile.r, tile.c)) {
              // Ensure separation push does not violate player safe distance
              if (Math.hypot(candX - pX, candY - pY) >= safeDistance) {
                this.x = candX;
                this.y = candY;
              }
            }
          }
        }
      }
    }

    // 5. Active tracking visuals: aim surveillance eye directly at player
    const angleToPlayer = Math.atan2(pY - this.y, pX - this.x);
    const eyeOffsetX = Math.cos(angleToPlayer) * 2.2;
    const eyeOffsetY = Math.sin(angleToPlayer) * 2.2;
    this.renderChassis(eyeOffsetX, eyeOffsetY);

    if (this.container) {
      this.container.setPosition(this.x, this.y);
    }
  }

  // Reposition around player along adjacent open corridors without penetrating safe distance
  repositionAroundPlayer(playerR, playerC, pX, pY, safeDistance) {
    const dr = [-1, 1, 0, 0];
    const dc = [0, 0, -1, 1];
    const validMoves = [];

    for (let i = 0; i < 4; i++) {
      const nr = this.r + dr[i];
      const nc = this.c + dc[i];
      if (this.maze.isWalkable(nr, nc)) {
        const tPos = this.maze.getTileCenter(nr, nc);
        const d = Math.hypot(tPos.x - pX, tPos.y - pY);
        // Valid reposition: outside safe distance but within hunting proximity
        if (d >= safeDistance && d <= ENEMY_DANGER_RADIUS + 32) {
          validMoves.push({ r: nr, c: nc, dist: d });
        }
      }
    }

    if (validMoves.length > 0) {
      // Sort to stay close and apply role variety
      validMoves.sort((a, b) => a.dist - b.dist);
      const chosen = (Math.random() < 0.7 || validMoves.length === 1) ? validMoves[0] : validMoves[1];
      this.nextTile = { r: chosen.r, c: chosen.c };
    }
  }

  planPath(playerR, playerC, playerHeading = { x: 1, y: 0 }, allEnemies = [], pX = null, pY = null) {
    const safeDistance = this.getSafeDistance();
    const curDist = Math.hypot(
      this.x - (pX !== null ? pX : this.maze.getTileCenter(playerR, playerC).x),
      this.y - (pY !== null ? pY : this.maze.getTileCenter(playerR, playerC).y)
    );

    // If already at safe distance, reposition rather than pathfinding through the player
    if (curDist <= safeDistance + 4) {
      this.repositionAroundPlayer(playerR, playerC, pX || this.x, pY || this.y, safeDistance);
      return;
    }

    // Dynamic chase chance: 50% early game -> ~74% mid-game -> ~98% late game
    const chaseChance = 0.50 + 0.48 * this.gameProgress;
    const shouldChase = Math.random() < chaseChance;

    if (shouldChase) {
      let targetR = playerR;
      let targetC = playerC;

      // Role-specific behaviors
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

    // Roam corridors while bias-drifting closer to player
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
        const choice = valid[Math.floor(Math.random() * valid.length)];
        this.currentPath = [choice];
      } else {
        valid.sort((a, b) => {
          const distA = Math.hypot(a.r - playerR, a.c - playerC);
          const distB = Math.hypot(b.r - playerR, b.c - playerC);
          return distA - distB;
        });
        const pick = (Math.random() < 0.8 || valid.length === 1) ? valid[0] : valid[1];
        this.currentPath = [pick];
      }
    }
  }

  destroy() {
    if (this.auraTween) {
      this.auraTween.stop();
    }
    if (this.container) {
      this.container.destroy();
    }
  }
}
