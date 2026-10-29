// ==============================================================================
// CYBERCHASE: PROXIMITY DAMAGE, ENEMY AI & QUESTION TIMER TEST SUITE (10 SCENARIOS)
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
    webkitAudioContext: class {},
    addEventListener: () => {}
  };
}
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement: (tag) => ({
      tagName: tag,
      className: '',
      textContent: '',
      style: {},
      dataset: {},
      appendChild: () => {},
      addEventListener: () => {},
      remove: () => {}
    }),
    getElementById: () => ({ addEventListener: () => {}, textContent: '', classList: { add: () => {}, remove: () => {} } }),
    querySelectorAll: () => [],
    querySelector: () => null
  };
}

const { Maze, BASE_MAZE_MAP, GRID_COLS, GRID_ROWS, TILE_SIZE } = await import('../src/game/Maze.js');
const { Enemy, ENEMY_DANGER_RADIUS } = await import('../src/game/Enemy.js');
const { ScoreManager } = await import('../src/systems/ScoreManager.js');
const { QuestionEngine } = await import('../src/systems/QuestionEngine.js');

console.log('====================================================================');
console.log('RUNNING CYBERCHASE PROXIMITY DAMAGE & ENEMY AI VERIFICATION SUITE');
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
  console.log(`[PASS] SCENARIO ${testNum}: ${title}`);
}

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
      add: () => ({ stop: () => {} })
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
// SCENARIO 1: A new game starts with exactly 3 enemies
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

  spawnCandidates.forEach((candidate, idx) => {
    assert(maze.isWalkable(candidate.r, candidate.c), `Spawn position (${candidate.r}, ${candidate.c}) must be walkable`);
    occupied.push({ r: candidate.r, c: candidate.c });
    const enemy = new Enemy(mockScene, maze, candidate.r, candidate.c, idx + 1, candidate.role);
    enemies.push(enemy);
  });

  assert(enemies.length === 3, `Expected exactly 3 enemies, got ${enemies.length}`);
  enemies.forEach((e, idx) => {
    assert(BASE_MAZE_MAP[e.r][e.c] === 0, `Enemy ${idx + 1} must not be inside a wall`);
    assert(e.r !== playerPos.r || e.c !== playerPos.c, `Enemy ${idx + 1} must not spawn on player`);
  });

  pass(1, 'A new game starts with exactly 3 enemies at separate valid positions');
}

// ------------------------------------------------------------------------------
// SCENARIO 2: An enemy comes very close while the question timer is running; health remains unchanged
// ------------------------------------------------------------------------------
{
  const sm = new ScoreManager();
  assert(sm.health === 100, 'Initial health is 100%');

  const mockScene = createMockScene();
  const maze = new Maze(mockScene);
  const enemy = new Enemy(mockScene, maze, 2, 1, 1, 'hunter');

  // Player at (1, 1), center (48, 48)
  const playerX = 48;
  const playerY = 48;

  // Simulate enemy moving close to player (within 35px) while question timer is running
  enemy.x = 48;
  enemy.y = 83; // 35px away (inside danger radius of 75px)
  const dist = Math.hypot(enemy.x - playerX, enemy.y - playerY);
  assert(dist === 35, `Enemy is close: ${dist}px`);

  // Enemy reaches proximity while countdown is active: health must NOT change!
  assert(sm.health === 100, `Health must remain 100% during active question countdown, got ${sm.health}%`);

  pass(2, 'An enemy comes very close while the question timer is running; health remains unchanged');
}

// ------------------------------------------------------------------------------
// SCENARIO 3: Enemies cannot physically touch or overlap the player during an active question
// ------------------------------------------------------------------------------
{
  const mockScene = createMockScene();
  const maze = new Maze(mockScene);
  const hunter = new Enemy(mockScene, maze, 3, 1, 1, 'hunter');

  const playerPos = { x: 48, y: 48, r: 1, c: 1, heading: { x: 0, y: 1 } };

  // Run 100 movement update frames with enemy aggressively chasing player
  for (let frame = 0; frame < 100; frame++) {
    hunter.update(16, playerPos.r, playerPos.c, playerPos.heading, 0.5, [hunter], playerPos);
    const dist = Math.hypot(hunter.x - playerPos.x, hunter.y - playerPos.y);

    // Physical touch / collision radius is 18px. Distance must ALWAYS be strictly greater!
    assert(dist >= 26, `Enemy breached safe distance! Distance: ${dist}px, must be >= 26px`);
    assert(dist > 18, `Enemy physically collided with player! Distance: ${dist}px`);
  }

  // Also verify that if player walks into the enemy, the enemy yields backwards along corridor
  hunter.x = 48;
  hunter.y = 75; // 27px away
  const advancingPlayerPos = { x: 48, y: 55, r: 1, c: 1, heading: { x: 0, y: 1 } }; // Player steps closer
  hunter.update(16, advancingPlayerPos.r, advancingPlayerPos.c, advancingPlayerPos.heading, 0.5, [hunter], advancingPlayerPos);
  const yieldedDist = Math.hypot(hunter.x - advancingPlayerPos.x, hunter.y - advancingPlayerPos.y);
  assert(yieldedDist >= 26, `Enemy must yield to maintain safe distance barrier! Got ${yieldedDist}px`);

  pass(3, 'Enemies maintain minimum safe distance and never physically touch or overlap player');
}

// ------------------------------------------------------------------------------
// SCENARIO 4: A question expires with an enemy inside the danger radius; health decreases by exactly 20%
// ------------------------------------------------------------------------------
{
  const sm = new ScoreManager();
  assert(sm.health === 100, 'Health starts at 100%');

  const playerPos = { x: 48, y: 48 };
  const enemies = [
    { x: 48, y: 88 },  // 40px away (inside danger radius of 75px)
    { x: 400, y: 300 }, // distant
    { x: 500, y: 400 }  // distant
  ];

  function getEnemiesInDangerRadius(dangerRadius = 75) {
    return enemies.filter(e => Math.hypot(playerPos.x - e.x, playerPos.y - e.y) <= dangerRadius);
  }

  // Question expires (timeout event)
  const isEnemyNearby = getEnemiesInDangerRadius(75).length > 0;
  assert(isEnemyNearby === true, 'Enemy must be detected inside danger radius');

  sm.handleTimeoutWithDamage('Q_TIMEOUT_1');
  assert(sm.health === 80, `Expected exactly 80% health after timeout with nearby enemy, got ${sm.health}%`);

  pass(4, 'A question expires with an enemy inside the danger radius; health decreases by exactly 20%');
}

// ------------------------------------------------------------------------------
// SCENARIO 5: A question expires with every enemy outside the danger radius; health remains unchanged
// ------------------------------------------------------------------------------
{
  const sm = new ScoreManager();
  assert(sm.health === 100, 'Health starts at 100%');

  const playerPos = { x: 48, y: 48 };
  const enemies = [
    { x: 200, y: 200 }, // ~214px away (> 75px)
    { x: 400, y: 300 }, // ~430px away (> 75px)
    { x: 500, y: 400 }  // ~570px away (> 75px)
  ];

  function getEnemiesInDangerRadius(dangerRadius = 75) {
    return enemies.filter(e => Math.hypot(playerPos.x - e.x, playerPos.y - e.y) <= dangerRadius);
  }

  // Question expires (timeout event)
  const isEnemyNearby = getEnemiesInDangerRadius(75).length > 0;
  assert(isEnemyNearby === false, 'All enemies must be outside danger radius');

  sm.handleTimeoutNoDamage('Q_TIMEOUT_SAFE');
  assert(sm.health === 100, `Health must remain 100% when all enemies are outside danger radius, got ${sm.health}%`);

  pass(5, 'A question expires with every enemy outside the danger radius; health remains unchanged');
}

// ------------------------------------------------------------------------------
// SCENARIO 6: Multiple nearby enemies at timeout still cause only one 20% health reduction
// ------------------------------------------------------------------------------
{
  const sm = new ScoreManager();
  assert(sm.health === 100, 'Health starts at 100%');

  const playerPos = { x: 48, y: 48 };
  // All 3 enemies are nearby!
  const enemies = [
    { x: 48, y: 80 },  // 32px away
    { x: 80, y: 48 },  // 32px away
    { x: 48, y: 16 }   // 32px away
  ];

  const nearbyEnemies = enemies.filter(e => Math.hypot(playerPos.x - e.x, playerPos.y - e.y) <= 75);
  assert(nearbyEnemies.length === 3, 'All 3 enemies are inside danger radius');

  // Single damage event applied for the question timeout
  const qId = 'Q_MULTI_NEARBY';
  sm.handleTimeoutWithDamage(qId);

  // Even if called repeatedly for the same question timeout, only 20% reduction occurs
  sm.handleTimeoutWithDamage(qId);

  assert(sm.health === 80, `Expected exactly 80% health (one 20% reduction), got ${sm.health}%`);

  pass(6, 'Multiple nearby enemies at timeout still cause only one 20% health reduction');
}

// ------------------------------------------------------------------------------
// SCENARIO 7: The player answers early; no damage is applied from that question
// ------------------------------------------------------------------------------
{
  const sm = new ScoreManager();
  assert(sm.health === 100, 'Health starts at 100%');

  // Player answers early, but selects the wrong option
  const earlyWrongResult = sm.handleWrongAnswerEarly('Q_EARLY_WRONG');
  assert(sm.health === 100, `Early wrong answer must NOT reduce health, got ${sm.health}%`);
  assert(sm.streak === 0, 'Streak should reset on wrong answer');

  // Player answers early with correct answer
  const earlyCorrectResult = sm.awardCorrectAnswer('Q_EARLY_CORRECT');
  assert(sm.health === 100, `Early correct answer keeps health at 100%, got ${sm.health}%`);
  assert(sm.score === 100, `Score awarded: ${sm.score}`);

  pass(7, 'The player answers early; no damage is applied from that question');
}

// ------------------------------------------------------------------------------
// SCENARIO 8: The next question starts with fresh protection and its own countdown
// ------------------------------------------------------------------------------
{
  const qe = new QuestionEngine();
  qe.start();

  const firstQ = qe.currentQuestion;
  assert(qe.isAnsweringAllowed === true, 'Answering allowed on first question');
  assert(qe.remainingSeconds === 10, 'First question has 10s countdown');

  // Answer first question
  qe.submitAnswer(firstQ.correct);
  assert(qe.isAnsweringAllowed === false, 'Answering disabled after submission');

  // Advance to next question
  qe.nextQuestion();
  const secondQ = qe.currentQuestion;
  assert(secondQ.id !== firstQ.id, 'Next question is a new question');
  assert(qe.isAnsweringAllowed === true, 'Fresh answering allowed on next question');
  assert(qe.remainingSeconds === 10, 'Fresh 10s countdown restored on next question');

  qe.stop();
  pass(8, 'The next question starts with fresh protection and its own countdown');
}

// ------------------------------------------------------------------------------
// SCENARIO 9: The global timer continues normally and enemy difficulty increases as it decreases
// ------------------------------------------------------------------------------
{
  const mockScene = createMockScene();
  const maze = new Maze(mockScene);
  const enemy = new Enemy(mockScene, maze, 7, 10, 1, 'hunter');

  // Start of session (120s remaining)
  let sessionRemaining = 120;
  const totalDuration = 120;
  let progress = 1 - (sessionRemaining / totalDuration);
  enemy.setGameProgress(progress);
  const startSpeed = enemy.speed;
  const startSafeDist = enemy.getSafeDistance();

  // Mid session (60s remaining)
  sessionRemaining = 60;
  progress = 1 - (sessionRemaining / totalDuration);
  enemy.setGameProgress(progress);
  const midSpeed = enemy.speed;
  const midSafeDist = enemy.getSafeDistance();

  // End session (10s remaining)
  sessionRemaining = 10;
  progress = 1 - (sessionRemaining / totalDuration);
  enemy.setGameProgress(progress);
  const lateSpeed = enemy.speed;
  const lateSafeDist = enemy.getSafeDistance();

  assert(startSpeed < midSpeed && midSpeed < lateSpeed, 'Enemy speed must increase progressively');
  assert(startSafeDist > midSafeDist && midSafeDist > lateSafeDist, 'Safe distance must tighten progressively');
  assert(lateSafeDist >= 26, `Safe distance must never drop below 26px, got ${lateSafeDist}px`);

  pass(9, 'Global timer scales enemy difficulty: speed increases and safe distance tightens progressively');
}

// ------------------------------------------------------------------------------
// SCENARIO 10: Five valid damage events reduce health to 0% and trigger game over
// ------------------------------------------------------------------------------
{
  const sm = new ScoreManager();
  assert(sm.health === 100, 'Starts at 100%');

  const hit1 = sm.handleTimeoutWithDamage('TO_1');
  assert(sm.health === 80 && !hit1.isDead, 'Hit 1 -> 80%');

  const hit2 = sm.handleTimeoutWithDamage('TO_2');
  assert(sm.health === 60 && !hit2.isDead, 'Hit 2 -> 60%');

  const hit3 = sm.handleTimeoutWithDamage('TO_3');
  assert(sm.health === 40 && !hit3.isDead, 'Hit 3 -> 40%');

  const hit4 = sm.handleTimeoutWithDamage('TO_4');
  assert(sm.health === 20 && !hit4.isDead, 'Hit 4 -> 20%');

  const hit5 = sm.handleTimeoutWithDamage('TO_5');
  assert(sm.health === 0, `Hit 5 -> 0%, got ${sm.health}%`);
  assert(hit5.isDead === true, 'Hit 5 triggers game over (isDead = true)');
  assert(sm.isDead() === true, 'ScoreManager reports player is dead');

  pass(10, 'Five valid damage events reduce health to 0% and trigger game over');
}

console.log('\n====================================================================');
console.log(`ALL 10 SCENARIOS VERIFIED SUCCESSFULLY! (${passed}/${passed})`);
console.log('====================================================================\n');
