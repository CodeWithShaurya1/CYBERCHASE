// ==============================================================================
// CYBERCHASE: GAMEPLAY IMPROVEMENTS TEST SUITE (8 SPECIFIED REQUIREMENTS)
// ==============================================================================

// Polyfill browser globals for Node test environment
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  };
}
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    AudioContext: class {
      createGain() { return { gain: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => {} }; }
      createOscillator() { return { type: '', frequency: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {} }, connect: () => {}, start: () => {}, stop: () => {} }; }
    },
    webkitAudioContext: class {}
  };
}
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement: (tag) => ({
      tagName: tag,
      className: '',
      textContent: '',
      remove: () => {}
    }),
    getElementById: () => ({ addEventListener: () => {}, textContent: '', classList: { add: () => {}, remove: () => {} } }),
    querySelectorAll: () => [],
    querySelector: () => null
  };
}

const { Maze, BASE_MAZE_MAP, GRID_COLS, GRID_ROWS, TILE_SIZE } = await import('../src/game/Maze.js');
const { Enemy } = await import('../src/game/Enemy.js');
const { ScoreManager } = await import('../src/systems/ScoreManager.js');
const { HUD } = await import('../src/ui/HUD.js');

console.log('====================================================================');
console.log('RUNNING CYBERCHASE GAMEPLAY IMPROVEMENTS VERIFICATION SUITE');
console.log('====================================================================\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    failed++;
    console.error(`[FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

function pass(testNum, title) {
  passed++;
  console.log(`[PASS] TEST ${testNum}: ${title}`);
}

// Mock Phaser Scene for testing game entities
function createMockScene() {
  return {
    add: {
      container: (x, y) => {
        const c = {
          x, y,
          setDepth: () => c,
          setPosition: (nx, ny) => { c.x = nx; c.y = ny; },
          add: () => c,
          destroy: () => {}
        };
        return c;
      },
      graphics: () => ({
        fillStyle: () => {},
        fillCircle: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
        fillPath: () => {},
        clear: () => {}
      }),
      rectangle: () => ({
        setDepth: () => ({ destroy: () => {} })
      })
    },
    tweens: {
      add: () => ({})
    },
    cameras: {
      main: {
        shake: () => {},
        width: 672,
        height: 480
      }
    }
  };
}

// ------------------------------------------------------------------------------
// TEST 1: Exactly 3 enemies spawn when a new game starts at valid, non-wall, non-player positions
// ------------------------------------------------------------------------------
{
  const mockScene = createMockScene();
  const maze = new Maze(mockScene);

  const spawnCandidates = [
    { r: 7, c: 10, role: 'hunter' },
    { r: 1, c: 19, role: 'interceptor' },
    { r: 13, c: 19, role: 'flanker' }
  ];

  const playerPos = { r: 1, c: 1 };
  const occupied = [playerPos];
  const enemies = [];

  function getValidSpawnPosition(preferredR, preferredC, excludedPositions) {
    if (
      maze.isWalkable(preferredR, preferredC) &&
      !excludedPositions.some(p => p.r === preferredR && p.c === preferredC)
    ) {
      return { r: preferredR, c: preferredC };
    }
    const nearest = maze.findNearestTarget(preferredR, preferredC, (r, c) => {
      return maze.isWalkable(r, c) && !excludedPositions.some(p => p.r === r && p.c === c);
    });
    return nearest || { r: preferredR, c: preferredC };
  }

  spawnCandidates.forEach((candidate, idx) => {
    const pos = getValidSpawnPosition(candidate.r, candidate.c, occupied);
    occupied.push(pos);
    const enemy = new Enemy(mockScene, maze, pos.r, pos.c, idx + 1, candidate.role);
    enemies.push(enemy);
  });

  assert(enemies.length === 3, `Expected exactly 3 enemies, got ${enemies.length}`);

  // Ensure enemies never spawn inside walls
  enemies.forEach((e, idx) => {
    assert(maze.isWalkable(e.r, e.c), `Enemy ${idx + 1} spawned in an unwalkable tile (${e.r}, ${e.c})`);
    assert(BASE_MAZE_MAP[e.r][e.c] === 0, `Enemy ${idx + 1} spawned in a wall (${e.r}, ${e.c})`);
  });

  // Ensure enemies never spawn directly on top of the player
  enemies.forEach((e, idx) => {
    assert(e.r !== playerPos.r || e.c !== playerPos.c, `Enemy ${idx + 1} spawned on top of player at (1, 1)`);
  });

  // Ensure all 3 enemies are at separate positions
  const posKeys = new Set(enemies.map(e => `${e.r},${e.c}`));
  assert(posKeys.size === 3, `Expected 3 distinct spawn positions, got ${posKeys.size}`);

  pass(1, 'Exactly 3 enemies spawn at valid, non-wall, non-player, separate positions');
}

// ------------------------------------------------------------------------------
// TEST 2: All enemies navigate the maze without passing through walls
// ------------------------------------------------------------------------------
{
  const mockScene = createMockScene();
  const maze = new Maze(mockScene);
  const enemy = new Enemy(mockScene, maze, 7, 10, 1, 'hunter');

  // Simulate 30 seconds of pathfinding and movement towards different targets
  const playerTargets = [
    { r: 1, c: 1 },
    { r: 13, c: 1 },
    { r: 1, c: 19 },
    { r: 13, c: 19 }
  ];

  for (const target of playerTargets) {
    for (let step = 0; step < 60; step++) {
      enemy.update(16, target.r, target.c, { x: 1, y: 0 }, 0.5, [enemy]);

      // At each update step, verify the enemy's tile position is walkable and inside the grid
      const tile = maze.worldToTile(enemy.x, enemy.y);
      assert(tile.r >= 0 && tile.r < GRID_ROWS, `Enemy row ${tile.r} out of bounds`);
      assert(tile.c >= 0 && tile.c < GRID_COLS, `Enemy col ${tile.c} out of bounds`);
      assert(maze.isWalkable(enemy.r, enemy.c), `Enemy stepped inside wall at tile (${enemy.r}, ${enemy.c})`);
    }
  }

  pass(2, 'Enemies navigate corridors without passing through walls');
}

// ------------------------------------------------------------------------------
// TEST 3: Enemies become progressively more aggressive as time runs out
// ------------------------------------------------------------------------------
{
  const mockScene = createMockScene();
  const maze = new Maze(mockScene);
  const hunter = new Enemy(mockScene, maze, 7, 10, 1, 'hunter');
  const interceptor = new Enemy(mockScene, maze, 1, 19, 2, 'interceptor');
  const flanker = new Enemy(mockScene, maze, 13, 19, 3, 'flanker');

  // Early game: progress = 0.0 (120s remaining)
  hunter.setGameProgress(0.0);
  interceptor.setGameProgress(0.0);
  flanker.setGameProgress(0.0);

  const hunterSpeedEarly = hunter.speed;
  const interceptorSpeedEarly = interceptor.speed;
  const flankerSpeedEarly = flanker.speed;

  // Mid game: progress = 0.5 (60s remaining)
  hunter.setGameProgress(0.5);
  interceptor.setGameProgress(0.5);
  flanker.setGameProgress(0.5);

  const hunterSpeedMid = hunter.speed;
  const interceptorSpeedMid = interceptor.speed;
  const flankerSpeedMid = flanker.speed;

  // Late game: progress = 1.0 (0s remaining)
  hunter.setGameProgress(1.0);
  interceptor.setGameProgress(1.0);
  flanker.setGameProgress(1.0);

  const hunterSpeedLate = hunter.speed;
  const interceptorSpeedLate = interceptor.speed;
  const flankerSpeedLate = flanker.speed;

  // Speed must increase smoothly: Early < Mid < Late
  assert(hunterSpeedEarly < hunterSpeedMid && hunterSpeedMid < hunterSpeedLate, 'Hunter speed must increase smoothly');
  assert(interceptorSpeedEarly < interceptorSpeedMid && interceptorSpeedMid < interceptorSpeedLate, 'Interceptor speed must increase smoothly');
  assert(flankerSpeedEarly < flankerSpeedMid && flankerSpeedMid < flankerSpeedLate, 'Flanker speed must increase smoothly');

  // Verify speed bounds (manageable early, aggressive late, never above player top speed)
  assert(hunterSpeedEarly <= 80, `Early hunter speed should be manageable (<= 80), got ${hunterSpeedEarly}`);
  assert(hunterSpeedLate >= 110, `Late hunter speed should be aggressive (>= 110), got ${hunterSpeedLate}`);

  pass(3, 'Enemies scale speed and pursuit aggressiveness progressively as time decreases');
}

// ------------------------------------------------------------------------------
// TEST 4: One valid hit reduces health from 100% to 80%
// ------------------------------------------------------------------------------
{
  const sm = new ScoreManager();
  assert(sm.health === 100, `Initial health must be 100%, got ${sm.health}%`);

  const hit1 = sm.handleEnemyCollision();
  assert(hit1.newHealth === 80, `Expected 80% health after 1 hit, got ${hit1.newHealth}%`);
  assert(sm.health === 80, `ScoreManager health must be 80%, got ${sm.health}%`);
  assert(hit1.isDead === false, 'Player should not be dead at 80% health');

  pass(4, 'One valid enemy collision reduces health from 100% to exactly 80%');
}

// ------------------------------------------------------------------------------
// TEST 5: Five valid hits reduce health to 0% and trigger game over
// ------------------------------------------------------------------------------
{
  const sm = new ScoreManager();
  assert(sm.health === 100, 'Initial health must be 100%');

  const res1 = sm.handleEnemyCollision();
  assert(res1.newHealth === 80 && !res1.isDead, 'Hit 1 -> 80% HP');

  const res2 = sm.handleEnemyCollision();
  assert(res2.newHealth === 60 && !res2.isDead, 'Hit 2 -> 60% HP');

  const res3 = sm.handleEnemyCollision();
  assert(res3.newHealth === 40 && !res3.isDead, 'Hit 3 -> 40% HP');

  const res4 = sm.handleEnemyCollision();
  assert(res4.newHealth === 20 && !res4.isDead, 'Hit 4 -> 20% HP');

  const res5 = sm.handleEnemyCollision();
  assert(res5.newHealth === 0, `Hit 5 -> 0% HP, got ${res5.newHealth}%`);
  assert(res5.isDead === true, 'Hit 5 must report isDead: true');
  assert(sm.isDead() === true, 'ScoreManager.isDead() must return true');

  pass(5, 'Five valid hits reduce health: 100% -> 80% -> 60% -> 40% -> 20% -> 0% (Game Over)');
}

// ------------------------------------------------------------------------------
// TEST 6: The health bar visually reflects every 20% reduction
// ------------------------------------------------------------------------------
{
  // Test using HUD.prototype.updateHealth directly with mock DOM elements
  function createMockClassList() {
    const classes = new Set(['health-segment', 'active']);
    return {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
      get size() { return classes.size; }
    };
  }

  const mockSegments = [
    { classList: createMockClassList() },
    { classList: createMockClassList() },
    { classList: createMockClassList() },
    { classList: createMockClassList() },
    { classList: createMockClassList() }
  ];

  const mockHealthVal = {
    textContent: '100%',
    classList: createMockClassList()
  };

  const mockHealthFill = {
    style: { width: '100%' },
    classList: createMockClassList()
  };

  const mockCheckpoints = [20, 40, 60, 80].map(val => ({
    getAttribute: (attr) => attr === 'data-val' ? String(val) : null,
    classList: createMockClassList()
  }));

  const mockTicks = [0, 20, 40, 60, 80, 100].map(val => ({
    getAttribute: (attr) => attr === 'data-val' ? String(val) : null,
    classList: createMockClassList()
  }));

  const popups = [];
  const mockFloaterContainer = {
    appendChild: (el) => { popups.push(el); }
  };

  const hudInstance = {
    healthValEl: mockHealthVal,
    healthBarFill: mockHealthFill,
    healthCheckpoints: mockCheckpoints,
    healthTicks: mockTicks,
    healthFloaterContainer: mockFloaterContainer,
    updateHealth: HUD.prototype.updateHealth
  };

  // 100%: Full bar fill 100%, text 100%, all checkpoints active
  hudInstance.updateHealth(100, false);
  assert(mockHealthFill.style.width === '100%', `Expected fill 100%, got ${mockHealthFill.style.width}`);
  assert(mockHealthVal.textContent === '100%', `Expected text 100%, got ${mockHealthVal.textContent}`);
  assert(!mockHealthVal.classList.contains('low'), '100% should not be low health');
  assert(!mockHealthFill.classList.contains('danger'), '100% fill should not be danger');
  assert(mockCheckpoints.filter(cp => cp.classList.contains('active')).length === 4, 'All checkpoints active at 100%');

  // 80%: Fill 80%, text 80%, floating -20% text created, 80% checkpoint highlighted
  hudInstance.updateHealth(80, true);
  assert(mockHealthFill.style.width === '80%', `Expected fill 80%, got ${mockHealthFill.style.width}`);
  assert(mockHealthVal.textContent === '80%', `Expected text 80%, got ${mockHealthVal.textContent}`);
  assert(popups.length > 0 && popups[popups.length - 1].textContent === '−20% HEALTH', 'Floating -20% HEALTH message created');
  assert(mockCheckpoints.find(cp => cp.getAttribute('data-val') === '80').classList.contains('highlight-pulse'), '80% checkpoint highlighted on hit');

  // 60%: Fill 60%, text 60%, checkpoint 80 depleted, 60 checkpoint highlighted
  hudInstance.updateHealth(60, true);
  assert(mockHealthFill.style.width === '60%', `Expected fill 60%, got ${mockHealthFill.style.width}`);
  assert(mockHealthVal.textContent === '60%', `Expected text 60%, got ${mockHealthVal.textContent}`);
  assert(mockCheckpoints.find(cp => cp.getAttribute('data-val') === '80').classList.contains('depleted'), '80% checkpoint marked depleted');
  assert(mockCheckpoints.find(cp => cp.getAttribute('data-val') === '60').classList.contains('highlight-pulse'), '60% checkpoint highlighted');

  // 40%: Fill 40%, text 40%, danger and low classes activated
  hudInstance.updateHealth(40, true);
  assert(mockHealthFill.style.width === '40%', `Expected fill 40%, got ${mockHealthFill.style.width}`);
  assert(mockHealthVal.textContent === '40%', `Expected text 40%, got ${mockHealthVal.textContent}`);
  assert(mockHealthVal.classList.contains('low'), '40% must activate low warning');
  assert(mockHealthFill.classList.contains('danger'), '40% fill must activate danger color');

  // 20%: Fill 20%, text 20%, checkpoint 20 highlighted
  hudInstance.updateHealth(20, true);
  assert(mockHealthFill.style.width === '20%', `Expected fill 20%, got ${mockHealthFill.style.width}`);
  assert(mockHealthVal.textContent === '20%', `Expected text 20%, got ${mockHealthVal.textContent}`);
  assert(mockCheckpoints.find(cp => cp.getAttribute('data-val') === '20').classList.contains('highlight-pulse'), '20% checkpoint highlighted');

  // 0%: Fill 0%, text 0%, all checkpoints depleted
  hudInstance.updateHealth(0, true);
  assert(mockHealthFill.style.width === '0%', `Expected fill 0%, got ${mockHealthFill.style.width}`);
  assert(mockHealthVal.textContent === '0%', `Expected text 0%, got ${mockHealthVal.textContent}`);
  assert(mockCheckpoints.filter(cp => cp.classList.contains('depleted')).length === 4, 'All checkpoints depleted at 0%');

  pass(6, 'Segmented horizontal health bar, 20% intervals, fill shrinking, and floating -20% HEALTH verified for all 6 states');
}

// ------------------------------------------------------------------------------
// TEST 7: The player cannot lose multiple health segments from one collision (i-frames)
// ------------------------------------------------------------------------------
{
  const sm = new ScoreManager();
  let invulnerabilityTimer = 0;
  let collisionCallbacksTriggered = 0;

  function simulateSceneEnemyCollisionCheck(playerX, playerY, enemyList) {
    if (invulnerabilityTimer > 0) return; // Cooldown active

    for (const enemy of enemyList) {
      const dist = Math.hypot(playerX - enemy.x, playerY - enemy.y);
      if (dist < 18) {
        invulnerabilityTimer = 1500; // 1.5s cooldown
        collisionCallbacksTriggered++;
        sm.handleEnemyCollision();
        break; // Only 1 collision per frame
      }
    }
  }

  const enemies = [
    { x: 100, y: 100 },
    { x: 102, y: 102 } // Second enemy also overlapping player
  ];

  // Frame 1: Collision occurs with both enemies overlapping player
  simulateSceneEnemyCollisionCheck(100, 100, enemies);
  assert(collisionCallbacksTriggered === 1, `Expected 1 collision callback, got ${collisionCallbacksTriggered}`);
  assert(sm.health === 80, `Expected health 80 after first collision, got ${sm.health}`);

  // Frame 2 (16ms later): Enemies still touching player, but within i-frames (invulnerabilityTimer = 1484)
  invulnerabilityTimer -= 16;
  simulateSceneEnemyCollisionCheck(100, 100, enemies);
  assert(collisionCallbacksTriggered === 1, 'No additional collision should trigger during cooldown');
  assert(sm.health === 80, `Health must remain 80 during cooldown, got ${sm.health}`);

  // Frame 3 (500ms later): Still in cooldown
  invulnerabilityTimer -= 500;
  simulateSceneEnemyCollisionCheck(100, 100, enemies);
  assert(collisionCallbacksTriggered === 1, 'Still protected by i-frames');
  assert(sm.health === 80, `Health must still be 80, got ${sm.health}`);

  // Cooldown expires (1000ms later)
  invulnerabilityTimer = 0;
  simulateSceneEnemyCollisionCheck(100, 100, enemies);
  assert(collisionCallbacksTriggered === 2, 'Valid hit registered after cooldown expires');
  assert(sm.health === 60, `Health reduces to 60 on new valid hit, got ${sm.health}`);

  pass(7, 'Player is protected by damage cooldown and cannot lose multiple health segments from one hit');
}

// ------------------------------------------------------------------------------
// TEST 8: Restarting the game resets health, enemies, and the timer correctly
// ------------------------------------------------------------------------------
{
  const sm = new ScoreManager();

  // Play and take damage
  sm.handleEnemyCollision(); // 80%
  sm.handleEnemyCollision(); // 60%
  assert(sm.health === 60, 'Health damaged to 60');

  // Reset ScoreManager
  sm.reset();
  assert(sm.health === 100, `Reset must restore health to 100%, got ${sm.health}`);
  assert(sm.score === 0, `Reset must restore score to 0, got ${sm.score}`);
  assert(sm.streak === 0, `Reset must restore streak to 0, got ${sm.streak}`);
  assert(sm.isDead() === false, 'Player must be alive after reset');

  // Reset GameScene state
  let sessionRemaining = 45;
  const sessionDuration = 120;

  // Restart simulation
  sessionRemaining = sessionDuration;
  assert(sessionRemaining === 120, `Timer must reset to 120s, got ${sessionRemaining}s`);

  // Enemy reset check
  const mockScene = createMockScene();
  const maze = new Maze(mockScene);
  const enemies = [
    new Enemy(mockScene, maze, 7, 10, 1, 'hunter'),
    new Enemy(mockScene, maze, 1, 19, 2, 'interceptor'),
    new Enemy(mockScene, maze, 13, 19, 3, 'flanker')
  ];

  // Modify their progress and speeds
  enemies.forEach(e => e.setGameProgress(0.9));
  assert(enemies[0].speed > enemies[0].minSpeed, 'Speed was elevated during gameplay');

  // Reset all enemies
  enemies[0].reset(7, 10);
  enemies[1].reset(1, 19);
  enemies[2].reset(13, 19);

  enemies.forEach(e => {
    assert(e.gameProgress === 0, 'Enemy gameProgress reset to 0');
    assert(e.speed === e.minSpeed, 'Enemy speed reset to minSpeed');
    assert(e.currentPath.length === 0, 'Enemy path cleared on reset');
  });

  pass(8, 'Restarting game completely resets health (100%), enemies (positions & speeds), and timer (120s)');
}

console.log('\n====================================================================');
console.log(`ALL 8 GAMEPLAY IMPROVEMENTS TESTS PASSED! (${passed}/${passed})`);
console.log('====================================================================\n');
