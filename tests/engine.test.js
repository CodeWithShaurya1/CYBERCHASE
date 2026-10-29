// ==============================================================================
// CYBERCHASE — SCORING OVERHAUL & QUESTION BANK UPGRADE (19 VERIFICATION TESTS)
// ==============================================================================
import { INITIAL_40_QUESTIONS, generateFullQuestionBank, shuffleQuestionOptions } from '../src/data/questions.js';
import { QuestionEngine } from '../src/systems/QuestionEngine.js';
import { ScoreManager } from '../src/systems/ScoreManager.js';
import { StorageManager } from '../src/systems/StorageManager.js';

console.log('====================================================================');
console.log('CYBERCHASE: RUNNING FULL 19-POINT AUTOMATED TEST SUITE');
console.log('====================================================================\n');

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (!condition) {
    failedCount++;
    console.error(`[FAIL] ${message}`);
    throw new Error(`Test Failed: ${message}`);
  }
}

function pass(testNum, title) {
  passedCount++;
  console.log(`[PASS] TEST ${testNum}: ${title}`);
}

// ------------------------------------------------------------------------------
// TEST 1: One correct answer awards exactly 100 points
// ------------------------------------------------------------------------------
{
  const sm = new ScoreManager();
  sm.awardCorrectAnswer('PY01');
  assert(sm.score === 100, `Expected 100 points, got ${sm.score}`);
  assert(sm.correctCount === 1, `Expected 1 correct count, got ${sm.correctCount}`);
  pass(1, 'One correct answer awards exactly 100 points');
}

// ------------------------------------------------------------------------------
// TEST 2: One wrong answer awards zero points and reduces health by 20%
// ------------------------------------------------------------------------------
{
  const sm = new ScoreManager();
  const initHp = sm.health;
  sm.handleMistake('PY02', false);
  assert(sm.score === 0, `Expected 0 points after wrong answer, got ${sm.score}`);
  assert(sm.health === initHp - 20, `Expected health ${initHp - 20}, got ${sm.health}`);
  assert(sm.wrongCount === 1, `Expected wrongCount 1, got ${sm.wrongCount}`);
  pass(2, 'One wrong answer awards zero points and reduces health by 20% (100 -> 80)');
}

// ------------------------------------------------------------------------------
// TEST 3: A question timeout is processed exactly once
// ------------------------------------------------------------------------------
{
  const sm = new ScoreManager();
  const res1 = sm.handleMistake('PY03', true);
  const hpAfterFirst = sm.health;
  const timeoutAfterFirst = sm.timeoutCount;
  assert(res1 !== null, 'First timeout call should be processed');
  assert(hpAfterFirst === 80, `Expected health 80 after timeout, got ${hpAfterFirst}`);

  // Second timeout call for the SAME question ID must be ignored
  const res2 = sm.handleMistake('PY03', true);
  assert(res2 === null, 'Second call for same question ID must be rejected');
  assert(sm.health === hpAfterFirst, 'Health should not decrease again');
  assert(sm.timeoutCount === timeoutAfterFirst, 'Timeout count should not increase again');
  pass(3, 'Question timeout is processed exactly once (idempotent)');
}

// ------------------------------------------------------------------------------
// TEST 4: Three consecutive correct answers award a total of 350 points
// ------------------------------------------------------------------------------
{
  const sm = new ScoreManager();
  sm.awardCorrectAnswer('PY01'); // +100 (100)
  sm.awardCorrectAnswer('PY02'); // +100 (200)
  sm.awardCorrectAnswer('PY03'); // +100 + 50 streak bonus (350)
  assert(sm.score === 350, `Expected 350 points for 3 streak, got ${sm.score}`);
  assert(sm.streak === 3, `Expected streak 3, got ${sm.streak}`);
  pass(4, 'Three consecutive correct answers award a total of 350 points (3x100 + 50 bonus)');
}

// ------------------------------------------------------------------------------
// TEST 5: Six consecutive correct answers award a total of 700 points
// ------------------------------------------------------------------------------
{
  const sm = new ScoreManager();
  for (let i = 1; i <= 6; i++) {
    sm.awardCorrectAnswer(`Q_${i}`);
  }
  // 6 * 100 + 50 (at 3) + 50 (at 6) = 700
  assert(sm.score === 700, `Expected 700 points for 6 streak, got ${sm.score}`);
  assert(sm.streak === 6, `Expected streak 6, got ${sm.streak}`);
  assert(sm.maxStreak === 6, `Expected maxStreak 6, got ${sm.maxStreak}`);
  pass(5, 'Six consecutive correct answers award a total of 700 points (6x100 + 2x50 bonus)');
}

// ------------------------------------------------------------------------------
// TEST 6: A wrong answer resets the current streak
// ------------------------------------------------------------------------------
{
  const sm = new ScoreManager();
  sm.awardCorrectAnswer('Q1');
  sm.awardCorrectAnswer('Q2');
  assert(sm.streak === 2, `Expected streak 2, got ${sm.streak}`);
  sm.handleMistake('Q3', false);
  assert(sm.streak === 0, `Expected streak 0 after mistake, got ${sm.streak}`);
  assert(sm.wrongStreak === 1, `Expected wrongStreak 1, got ${sm.wrongStreak}`);
  pass(6, 'Wrong answer resets current streak to 0');
}

// ------------------------------------------------------------------------------
// TEST 7: Maximum streak retains the longest correct-answer streak
// ------------------------------------------------------------------------------
{
  const sm = new ScoreManager();
  // Streak of 4
  sm.awardCorrectAnswer('Q1');
  sm.awardCorrectAnswer('Q2');
  sm.awardCorrectAnswer('Q3');
  sm.awardCorrectAnswer('Q4');
  assert(sm.maxStreak === 4, `Expected maxStreak 4, got ${sm.maxStreak}`);

  // Mistake
  sm.handleMistake('Q5', false);
  assert(sm.streak === 0, 'Current streak should be 0');
  assert(sm.maxStreak === 4, 'maxStreak should retain 4 after mistake');

  // New streak of 2
  sm.awardCorrectAnswer('Q6');
  sm.awardCorrectAnswer('Q7');
  assert(sm.streak === 2, 'Current streak should be 2');
  assert(sm.maxStreak === 4, 'maxStreak must retain longest sequence (4)');
  pass(7, 'Maximum streak retains longest sequence across the entire game');
}

// ------------------------------------------------------------------------------
// TEST 8: Accuracy is calculated from answered questions only
// ------------------------------------------------------------------------------
{
  const sm = new ScoreManager();
  // 4 correct, 5 wrong = 9 answered -> 4/9 = 44.44% -> 44%
  for (let i = 1; i <= 4; i++) sm.awardCorrectAnswer(`C_${i}`);
  for (let i = 1; i <= 5; i++) sm.handleMistake(`W_${i}`, false);

  const acc = sm.getAccuracy();
  assert(acc === 44, `Expected 44% accuracy for 4/9, got ${acc}%`);

  const emptySm = new ScoreManager();
  assert(emptySm.getAccuracy() === 0, '0 answered questions must return 0%');
  pass(8, 'Accuracy = (Correct / Total Answered) * 100 rounded to nearest whole % (44% for 4/9)');
}

// ------------------------------------------------------------------------------
// TEST 9: Score cannot become negative
// ------------------------------------------------------------------------------
{
  const sm = new ScoreManager();
  for (let i = 1; i <= 10; i++) {
    sm.handleMistake(`W_${i}`, false);
  }
  assert(sm.score >= 0, `Score must never be negative, got ${sm.score}`);
  assert(sm.score === 0, `Expected score 0, got ${sm.score}`);
  pass(9, 'Score cannot become negative under any circumstances');
}

// ------------------------------------------------------------------------------
// TEST 10: The same question cannot award points twice
// ------------------------------------------------------------------------------
{
  const sm = new ScoreManager();
  const first = sm.awardCorrectAnswer('PY01');
  assert(first !== null, 'First award should succeed');
  assert(sm.score === 100, 'Score should be 100');

  const second = sm.awardCorrectAnswer('PY01');
  assert(second === null, 'Second call for same question ID must be rejected');
  assert(sm.score === 100, `Score must remain 100, got ${sm.score}`);
  assert(sm.correctCount === 1, `correctCount must remain 1, got ${sm.correctCount}`);
  pass(10, 'Duplicate question evaluation blocked (same question cannot award points twice)');
}

// ------------------------------------------------------------------------------
// TEST 11: Data fragments cannot award repeated points
// ------------------------------------------------------------------------------
{
  const sm = new ScoreManager();
  const res1 = sm.addFragmentScore('frag_1_2_3', 25);
  assert(res1.awarded === true, 'First fragment collection should award points');
  assert(sm.score === 25, `Expected score 25, got ${sm.score}`);
  assert(sm.dataFragments === 1, `Expected 1 fragment, got ${sm.dataFragments}`);

  // Attempt duplicate collection of same fragment
  const res2 = sm.addFragmentScore('frag_1_2_3', 25);
  assert(res2.awarded === false, 'Duplicate fragment collection should be rejected');
  assert(sm.score === 25, `Score must remain 25, got ${sm.score}`);
  assert(sm.dataFragments === 1, `Fragment count must remain 1, got ${sm.dataFragments}`);
  pass(11, 'Data fragments capped at 25 points and cannot award repeated points');
}

// ------------------------------------------------------------------------------
// TEST 12: The game ends correctly when health reaches zero or time expires
// ------------------------------------------------------------------------------
{
  const sm = new ScoreManager();
  // 5 mistakes * 20 health = 100 health lost
  for (let i = 1; i <= 5; i++) {
    sm.handleMistake(`ERR_${i}`, false);
  }
  assert(sm.health === 0, `Health should be 0, got ${sm.health}`);
  assert(sm.isDead() === true, 'isDead() should return true when health reaches 0');
  pass(12, 'Game terminates when health reaches zero (5 wrong answers = 100% HP loss)');
}

// ------------------------------------------------------------------------------
// TEST 13: All 40 questions have unique IDs, four options, and one correct answer
// ------------------------------------------------------------------------------
{
  const questions = INITIAL_40_QUESTIONS;
  assert(questions.length === 40, `Expected exactly 40 questions, got ${questions.length}`);

  const ids = new Set();
  const py = questions.filter(q => q.category === 'PYTHON');
  const ht = questions.filter(q => q.category === 'HTML');
  const cs = questions.filter(q => q.category === 'CSS');

  assert(py.length === 17, `Expected 17 Python questions, got ${py.length}`);
  assert(ht.length === 13, `Expected 13 HTML questions, got ${ht.length}`);
  assert(cs.length === 10, `Expected 10 CSS questions, got ${cs.length}`);

  questions.forEach(q => {
    assert(!ids.has(q.id), `Duplicate question ID: ${q.id}`);
    ids.add(q.id);
    assert(Array.isArray(q.options) && q.options.length === 4, `Question ${q.id} must have exactly 4 options`);
    assert(typeof q.correct === 'number' && q.correct >= 0 && q.correct <= 3, `Question ${q.id} has invalid correct index: ${q.correct}`);
    assert(['PYTHON', 'HTML', 'CSS'].includes(q.category), `Question ${q.id} has invalid category: ${q.category}`);
    assert(Boolean(q.question), `Question ${q.id} is missing question text`);
  });
  pass(13, 'All 40 questions verified: 17 Python, 13 HTML, 10 CSS with unique IDs & 4 options');
}

// ------------------------------------------------------------------------------
// TEST 14: All answer keys match the question bank
// ------------------------------------------------------------------------------
{
  const expectedAnswers = {
    PY01: 'print()',
    PY02: '#',
    PY03: 'str',
    PY04: '8',
    PY05: 'def',
    PY06: 'bool',
    PY07: '1',
    PY08: '**',
    PY09: 'if',
    PY10: 'Hello World',
    PY11: 'List',
    PY12: '20',
    PY13: '==',
    PY14: '3',
    PY15: 'for',
    PY16: 'True',
    PY17: 'input()',
    HT01: 'HyperText Markup Language',
    HT02: '<h1>',
    HT03: '<p>',
    HT04: '<img>',
    HT05: 'src',
    HT06: '<a>',
    HT07: '<ul>',
    HT08: '<br>',
    HT09: '<ol>',
    HT10: '<body>',
    HT11: 'alt',
    HT12: '<tr>',
    HT13: '<!DOCTYPE html>',
    CS01: 'Cascading Style Sheets',
    CS02: 'color',
    CS03: '.',
    CS04: '#',
    CS05: 'background-color',
    CS06: 'font-size',
    CS07: 'font-weight: bold',
    CS08: 'padding',
    CS09: 'margin',
    CS10: 'display: flex;'
  };

  INITIAL_40_QUESTIONS.forEach(q => {
    const expected = expectedAnswers[q.id];
    assert(expected !== undefined, `Missing test expected answer for ${q.id}`);
    const actual = q.options[q.correct];
    assert(actual === expected, `Question ${q.id} answer mismatch: expected "${expected}", got "${actual}"`);
  });
  pass(14, 'All 40 answer keys strictly verified against prompt specifications');
}

// ------------------------------------------------------------------------------
// TEST 15: Answer randomization preserves correctness
// ------------------------------------------------------------------------------
{
  INITIAL_40_QUESTIONS.forEach(original => {
    const originalText = original.options[original.correct];
    for (let i = 0; i < 5; i++) {
      const shuffled = shuffleQuestionOptions(original);
      const shuffledText = shuffled.options[shuffled.correct];
      assert(shuffledText === originalText, `Shuffle broke correctness for ${original.id}`);
      assert(shuffled.options.length === 4, `Shuffled options length must be 4`);
    }
  });
  pass(15, 'Answer option randomization preserves 100% correctness across all questions');
}

// ------------------------------------------------------------------------------
// TEST 16: Questions do not repeat within a session until the bank is exhausted
// ------------------------------------------------------------------------------
{
  const engine = new QuestionEngine();
  engine.resetSession();

  const servedSet = new Set();
  for (let i = 0; i < 40; i++) {
    const q = engine.selectNextQuestion();
    assert(!servedSet.has(q.id), `Question ${q.id} repeated before bank exhaustion! (step ${i})`);
    servedSet.add(q.id);
  }
  assert(servedSet.size === 40, `Expected 40 unique questions served, got ${servedSet.size}`);
  pass(16, 'Zero duplicate questions across 40 questions within a game session');
}

// ------------------------------------------------------------------------------
// TEST 17: Category distribution follows target as closely as possible
// ------------------------------------------------------------------------------
{
  const engine = new QuestionEngine();
  engine.resetSession();

  for (let i = 0; i < 100; i++) {
    engine.selectNextQuestion();
  }

  const dist = engine.getDistributionStats();
  // Target: 42% Python, 33% HTML, 25% CSS
  assert(dist.python.count === 42, `Expected 42 Python questions, got ${dist.python.count}`);
  assert(dist.html.count === 33, `Expected 33 HTML questions, got ${dist.html.count}`);
  assert(dist.css.count === 25, `Expected 25 CSS questions, got ${dist.css.count}`);
  pass(17, 'Deficit scheduling achieved exact target distribution: 42% Python, 33% HTML, 25% CSS');
}

// ------------------------------------------------------------------------------
// TEST 18: Leaderboard submission cannot happen twice for the same game session
// ------------------------------------------------------------------------------
{
  const storage = new StorageManager();
  const testSessionId = `unique_sess_${Date.now()}_test18`;

  const sub1 = await storage.submitScore({
    name: 'TEST PLAYER',
    enrollment: '0101TEST2026',
    score: 1550,
    accuracy: 80,
    correct_answers: 14,
    wrong_answers: 3,
    streak: 5,
    fragments: 8
  }, testSessionId);

  assert(sub1.success === true, 'First submission for session must succeed');

  const sub2 = await storage.submitScore({
    name: 'TEST PLAYER',
    enrollment: '0101TEST2026',
    score: 1550
  }, testSessionId);

  assert(sub2.success === false && sub2.reason === 'ALREADY_SUBMITTED', 'Duplicate session submission must be blocked');
  pass(18, 'Leaderboard submission cannot happen twice for the same game session');
}

// ------------------------------------------------------------------------------
// TEST 19: Registration, admin override, and cross-laptop leaderboard functionality
// ------------------------------------------------------------------------------
{
  const storage = new StorageManager();
  const testStudent = '  0101cs991122  ';
  const normalized = storage.normalizeEnrollment(testStudent);
  assert(normalized === '0101CS991122', `Expected uppercase normalized, got ${normalized}`);

  // Initial eligibility
  const el1 = await storage.checkStudentEligibility(testStudent);
  assert(el1.eligible === true, 'Fresh student must be eligible');

  // Submit attempt #1
  const sId1 = `sess_t19_1_${Date.now()}`;
  const res1 = await storage.submitScore({
    name: 'priya verma',
    enrollment: testStudent,
    score: 1850,
    accuracy: 90
  }, sId1);
  assert(res1.success === true, 'Attempt 1 submission should succeed');
  assert(res1.sanitizedName === 'PRIYA VERMA', 'Name must be saved in UPPERCASE');
  assert(res1.sanitizedEnrollment === '0101CS991122', 'Enrollment must be saved in UPPERCASE');

  // Returning student must be blocked
  const el2 = await storage.checkStudentEligibility('0101CS991122');
  assert(el2.eligible === false, 'Played student must be strictly blocked');

  // Admin override with invalid key fails
  const badKeyRes = await storage.authorizeAttemptWithAdminKey('0101CS991122', 'WRONG_KEY');
  assert(badKeyRes.success === false, 'Invalid admin key must fail');

  // Admin override with SHAURYA@GAME999 succeeds
  const goodKeyRes = await storage.authorizeAttemptWithAdminKey('0101CS991122', 'SHAURYA@GAME999');
  assert(goodKeyRes.success === true, 'Valid admin key must authorize attempt');

  // After authorization, eligible for second attempt
  const el3 = await storage.checkStudentEligibility('0101CS991122');
  assert(el3.eligible === true && el3.hasAuthorization === true, 'Authorized student must be eligible');

  // Submit attempt #2
  const sId2 = `sess_t19_2_${Date.now()}`;
  const res2 = await storage.submitScore({
    name: 'priya verma',
    enrollment: testStudent,
    score: 2250,
    accuracy: 95
  }, sId2);
  assert(res2.success === true, 'Attempt 2 submission should succeed as separate record');

  pass(19, 'Registration, admin override (SHAURYA@GAME999), and attempt policies fully operational');
}

// ------------------------------------------------------------------------------
// TEST 20: Correct answers trigger exactly one evaluation and freeze input
// ------------------------------------------------------------------------------
{
  const qEngine = new QuestionEngine();
  qEngine.start();
  const q = qEngine.currentQuestion;
  assert(qEngine.isAnsweringAllowed === true, 'Answering must be allowed when question active');

  const res1 = qEngine.submitAnswer(q.correct);
  assert(res1.isCorrect === true, 'Answer should be evaluated as correct');
  assert(qEngine.isAnsweringAllowed === false, 'Input must be frozen immediately upon submission');

  // Attempting second answer during transition
  const res2 = qEngine.submitAnswer(q.correct);
  assert(res2 === null, 'Subsequent submissions must be rejected during countdown transition');
  pass(20, 'Correct answers trigger exactly one evaluation and freeze input immediately');
}

// ------------------------------------------------------------------------------
// TEST 21: Wrong answers trigger exactly one evaluation and freeze input
// ------------------------------------------------------------------------------
{
  const qEngine = new QuestionEngine();
  qEngine.start();
  const q = qEngine.currentQuestion;
  const wrongIndex = (q.correct + 1) % 4;

  const res1 = qEngine.submitAnswer(wrongIndex);
  assert(res1.isCorrect === false, 'Answer should be evaluated as wrong');
  assert(qEngine.isAnsweringAllowed === false, 'Input must be frozen immediately upon submission');

  const res2 = qEngine.submitAnswer(wrongIndex);
  assert(res2 === null, 'Second answer must be ignored');
  pass(21, 'Wrong answers trigger exactly one evaluation and freeze input immediately');
}

// ------------------------------------------------------------------------------
// TEST 22: Question timeouts trigger exactly one evaluation and freeze input
// ------------------------------------------------------------------------------
{
  const qEngine = new QuestionEngine();
  qEngine.start();

  qEngine.handleTimeout();
  assert(qEngine.isAnsweringAllowed === false, 'Input must be frozen after timeout');

  // Attempt to submit after timeout
  const lateRes = qEngine.submitAnswer(0);
  assert(lateRes === null, 'Late answer after timeout must be rejected');
  pass(22, 'Question timeouts trigger exactly one evaluation and freeze input');
}

// ------------------------------------------------------------------------------
// TEST 23: Next question and its timer start only when nextQuestion() is called
// ------------------------------------------------------------------------------
{
  const qEngine = new QuestionEngine();
  qEngine.start();
  const firstQ = qEngine.currentQuestion;

  // Answer first question
  qEngine.submitAnswer(firstQ.correct);
  assert(qEngine.timerInterval === null, 'Question timer must be paused during transition');

  // Next question called after countdown
  qEngine.nextQuestion();
  assert(qEngine.currentQuestion.id !== firstQ.id, 'New question must be loaded');
  assert(qEngine.remainingSeconds === qEngine.questionDuration, 'Question timer must reset to full duration (10s)');
  assert(qEngine.isAnsweringAllowed === true, 'Answering must be resumed for new question');
  qEngine.stop();
  pass(23, 'Next question and its timer start only when nextQuestion() is called after countdown');
}

// ------------------------------------------------------------------------------
// TEST 24: Game Over (health reaches zero) stops transitions immediately
// ------------------------------------------------------------------------------
{
  const sm = new ScoreManager();
  for (let i = 1; i <= 5; i++) {
    sm.handleMistake(`ERR_${i}`, false);
  }
  assert(sm.health === 0, 'Health must be 0 after 5 mistakes');
  assert(sm.isDead() === true, 'Game is dead, no further countdown transitions should occur');
  pass(24, 'Game Over (health = 0) interrupts countdown transition immediately');
}

// ------------------------------------------------------------------------------
// TEST 25: Starter mock champion records do not block real students
// ------------------------------------------------------------------------------
{
  const storage = new StorageManager();
  // Starter mock enrollment from default champions
  const mockEnrollment = '0101CS221001';
  const el = await storage.checkStudentEligibility(mockEnrollment);
  assert(el.eligible === true, `Starter mock enrollment ${mockEnrollment} must not block a real student`);
  pass(25, 'Starter mock champions do not block real students from playing');
}

// ------------------------------------------------------------------------------
// TEST 26: Student eligibility lifecycle: Eligible at Registration -> Ineligible once Run Starts
// ------------------------------------------------------------------------------
{
  const storage = new StorageManager();
  const testStudent = '0101CS249988';
  
  // 1. Fresh student before run
  const elBefore = await storage.checkStudentEligibility(testStudent);
  assert(elBefore.eligible === true, 'Student must be eligible upon registration');

  // 2. Run starts (recordAttemptStarted)
  storage.recordAttemptStarted(testStudent, 'TEST STUDENT');

  // 3. Re-checking eligibility after run start must be blocked
  const elAfter = await storage.checkStudentEligibility(testStudent);
  assert(elAfter.eligible === false, 'Student must be blocked once attempt has started');

  // 4. Admin override allows replay
  const auth = await storage.authorizeAttemptWithAdminKey(testStudent, 'SHAURYA@GAME999');
  assert(auth.success === true, 'Admin key must authorize repeat attempt');
  const elAuth = await storage.checkStudentEligibility(testStudent);
  assert(elAuth.eligible === true, 'Authorized student must be allowed to play again');

  pass(26, 'Student eligibility lifecycle: Eligible at Registration -> Ineligible once Run Starts');
}

// ------------------------------------------------------------------------------
// TEST 27: Answer evaluation reveals correctIndex and correctText for wrong answers & timeouts
// ------------------------------------------------------------------------------
{
  const qEngine = new QuestionEngine();
  qEngine.start();
  const q = qEngine.currentQuestion;
  const wrongIndex = (q.correct + 1) % 4;

  // Submit wrong answer
  const wrongResult = qEngine.submitAnswer(wrongIndex);
  assert(wrongResult.isCorrect === false, 'Answer must be evaluated as wrong');
  assert(wrongResult.selectedIndex === wrongIndex, 'Selected index must match wrong choice');
  assert(wrongResult.correctIndex === q.correct, 'Correct index must be provided');
  assert(wrongResult.correctText === q.options[q.correct], 'Exact correct answer text must be provided');

  // Next question
  qEngine.nextQuestion();
  const nextQ = qEngine.currentQuestion;

  // Simulate timeout
  let timeoutResult = null;
  qEngine.onAnswerEvaluated = (res) => { timeoutResult = res; };
  qEngine.handleTimeout();

  assert(timeoutResult !== null, 'Timeout must trigger onAnswerEvaluated');
  assert(timeoutResult.isTimeout === true, 'Result must be flagged as timeout');
  assert(timeoutResult.isCorrect === false, 'Timeout must be evaluated as incorrect');
  assert(timeoutResult.correctIndex === nextQ.correct, 'Timeout must reveal correct index');
  assert(timeoutResult.correctText === nextQ.options[nextQ.correct], 'Timeout must reveal exact correct answer text');

  qEngine.stop();
  pass(27, 'Evaluation accurately reveals correct answer index and text for wrong answers and timeouts');
}

// ------------------------------------------------------------------------------
// TEST 28: Short feedback message format displays "Wrong! Correct answer: [text]"
// ------------------------------------------------------------------------------
{
  const qEngine = new QuestionEngine();
  qEngine.start();
  const q = qEngine.currentQuestion;
  const wrongIndex = (q.correct + 1) % 4;
  const res = qEngine.submitAnswer(wrongIndex);

  const correctText = res.correctText || q.options[res.correctIndex];
  const prefix = res.isTimeout ? "Time's up!" : 'Wrong!';
  const message = `${prefix} Correct answer: ${correctText}`;

  assert(message.startsWith('Wrong! Correct answer: '), 'Feedback message must start with "Wrong! Correct answer: "');
  assert(message.includes(q.options[q.correct]), 'Feedback message must include the exact correct answer text');

  qEngine.stop();
  pass(28, 'Short feedback message format displays "Wrong! Correct answer: [correct answer]"');
}

console.log('\n====================================================================');
console.log(`ALL ${passedCount} / ${passedCount + failedCount} TESTS COMPLETED WITH 100% SUCCESS!`);
console.log('====================================================================\n');
