// Neon Cyberpunk Grid Maze with BFS Pathfinding & Obstacle Validation

export const TILE_SIZE = 32;
export const GRID_COLS = 21;
export const GRID_ROWS = 15;

// Labyrinth layout: 1 = Neon Wall, 0 = Open Corridor
// Symmetrical, interconnected Pac-Man style layout with open loops & intersections
export const BASE_MAZE_MAP = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1],
  [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
  [1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1],
  [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
  [1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0], // tunnel row
  [1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1],
  [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
  [1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1],
  [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
  [1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];

export class Maze {
  constructor(scene) {
    this.scene = scene;
    this.cols = GRID_COLS;
    this.rows = GRID_ROWS;
    this.tileSize = TILE_SIZE;

    // Active grid layout (copy of base maze)
    this.grid = BASE_MAZE_MAP.map(row => [...row]);
    // Set of blocked dynamic obstacle keys: "r,c"
    this.dynamicObstacles = new Map();

    this.wallGraphics = null;
    this.gridGraphics = null;
  }

  reset() {
    this.grid = BASE_MAZE_MAP.map(row => [...row]);
    this.dynamicObstacles.clear();
    this.renderWalls();
  }

  isWalkable(r, c) {
    // Handle horizontal tunnel wrap-around
    if (r === 7) {
      if (c < 0 || c >= this.cols) return true;
    }
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return false;
    if (this.grid[r][c] === 1) return false;
    if (this.dynamicObstacles.has(`${r},${c}`)) return false;
    return true;
  }

  getTileCenter(r, c) {
    return {
      x: c * this.tileSize + this.tileSize / 2,
      y: r * this.tileSize + this.tileSize / 2
    };
  }

  worldToTile(x, y) {
    return {
      r: Math.floor(y / this.tileSize),
      c: Math.floor(x / this.tileSize)
    };
  }

  // BFS Shortest Pathfinding
  findPath(startR, startC, targetR, targetC) {
    if (startR === targetR && startC === targetC) return [];
    if (!this.isWalkable(targetR, targetC)) return null;

    const queue = [[startR, startC]];
    const visited = new Set([`${startR},${startC}`]);
    const parentMap = new Map();

    const dr = [-1, 1, 0, 0];
    const dc = [0, 0, -1, 1];

    let found = false;

    while (queue.length > 0) {
      const [cr, cc] = queue.shift();

      if (cr === targetR && cc === targetC) {
        found = true;
        break;
      }

      for (let i = 0; i < 4; i++) {
        let nr = cr + dr[i];
        let nc = cc + dc[i];

        // Tunnel wrap
        if (nr === 7) {
          if (nc < 0) nc = this.cols - 1;
          else if (nc >= this.cols) nc = 0;
        }

        const key = `${nr},${nc}`;
        if (this.isWalkable(nr, nc) && !visited.has(key)) {
          visited.add(key);
          parentMap.set(key, [cr, cc]);
          queue.push([nr, nc]);
        }
      }
    }

    if (!found) return null;

    // Reconstruct path backward from target to start
    const path = [];
    let currKey = `${targetR},${targetC}`;
    const startKey = `${startR},${startC}`;

    while (currKey !== startKey) {
      const [pr, pc] = currKey.split(',').map(Number);
      path.unshift({ r: pr, c: pc });
      const parent = parentMap.get(currKey);
      if (!parent) break;
      currKey = `${parent[0]},${parent[1]}`;
    }

    return path;
  }

  // Find nearest reachable open position matching a condition
  findNearestTarget(startR, startC, targetPredicate) {
    const queue = [[startR, startC, 0]];
    const visited = new Set([`${startR},${startC}`]);

    const dr = [-1, 1, 0, 0];
    const dc = [0, 0, -1, 1];

    while (queue.length > 0) {
      const [cr, cc, dist] = queue.shift();

      if (dist > 0 && targetPredicate(cr, cc)) {
        return { r: cr, c: cc };
      }

      for (let i = 0; i < 4; i++) {
        let nr = cr + dr[i];
        let nc = cc + dc[i];

        if (nr === 7) {
          if (nc < 0) nc = this.cols - 1;
          else if (nc >= this.cols) nc = 0;
        }

        const key = `${nr},${nc}`;
        if (this.isWalkable(nr, nc) && !visited.has(key)) {
          visited.add(key);
          queue.push([nr, nc, dist + 1]);
        }
      }
    }
    return null;
  }

  // Verify that adding an obstacle at (r, c) does not disconnect the player or seal the maze
  canPlaceObstacle(r, c, playerR, playerC) {
    if (r === playerR && c === playerC) return false;
    if (this.grid[r][c] === 1) return false;
    if (this.dynamicObstacles.has(`${r},${c}`)) return false;

    // Temporarily add obstacle
    this.dynamicObstacles.set(`${r},${c}`, { type: 'test' });

    // Count reachable open tiles from player with BFS
    const visited = new Set();
    const queue = [[playerR, playerC]];
    visited.add(`${playerR},${playerC}`);

    let reachableCount = 0;
    while (queue.length > 0) {
      const [cr, cc] = queue.shift();
      reachableCount++;

      const dr = [-1, 1, 0, 0];
      const dc = [0, 0, -1, 1];
      for (let i = 0; i < 4; i++) {
        let nr = cr + dr[i];
        let nc = cc + dc[i];
        if (nr === 7) {
          if (nc < 0) nc = this.cols - 1;
          else if (nc >= this.cols) nc = 0;
        }
        const key = `${nr},${nc}`;
        if (this.isWalkable(nr, nc) && !visited.has(key)) {
          visited.add(key);
          queue.push([nr, nc]);
        }
      }
    }

    // Revert obstacle
    this.dynamicObstacles.delete(`${r},${c}`);

    // If player can reach at least 40 open tiles, the route is safe and not sealed
    return reachableCount >= 40;
  }

  // Draw cyber neon walls with multi-layer glow
  renderWalls() {
    if (this.wallGraphics) {
      this.wallGraphics.clear();
    } else {
      this.wallGraphics = this.scene.add.graphics();
      this.wallGraphics.setDepth(2);
    }

    const g = this.wallGraphics;
    const ts = this.tileSize;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] === 1) {
          const x = c * ts;
          const y = r * ts;

          // Outer cyan bloom
          g.lineStyle(4, 0x00f5ff, 0.25);
          g.strokeRoundedRect(x + 2, y + 2, ts - 4, ts - 4, 4);

          // Deep dark core
          g.fillStyle(0x0c142b, 0.95);
          g.fillRoundedRect(x + 4, y + 4, ts - 8, ts - 8, 3);

          // Electric purple accent edge
          g.lineStyle(1.5, 0x9d4edd, 0.85);
          g.strokeRoundedRect(x + 4, y + 4, ts - 8, ts - 8, 3);

          // Center tech node dot
          g.fillStyle(0x00f5ff, 0.5);
          g.fillCircle(x + ts / 2, y + ts / 2, 1.5);
        }
      }
    }
  }
}
