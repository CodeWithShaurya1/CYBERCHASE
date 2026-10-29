// ==============================================================================
// CYBERCHASE — AUTHORITATIVE SCORING SYSTEM & GAME TELEMETRY
// ==============================================================================
// 1. CORRECT ANSWER: +100 points
// 2. WRONG ANSWER: +0 points, reset streak
// 3. QUESTION TIMEOUT: +0 points, treated as wrong answer, reset streak
// 4. THREE CONSECUTIVE CORRECT ANSWERS: +50 bonus points
// 5. EVERY ADDITIONAL THREE CONSECUTIVE CORRECT ANSWERS: +50 bonus points
// 6. HEALTH LOSS: -20% of max health per wrong answer (100 -> 80 -> 60 -> 40 -> 20 -> 0)
// 7. SPEED BOOST: controlled increase up to maxSpeed
// 8. OBSTACLES: 1 spawned every 2 consecutive wrong answers
// 9. DATA FRAGMENTS: max 25 points per unique fragment, no duplicate scoring
// ==============================================================================

export class ScoreManager {
  constructor(options = {}) {
    this.onHealthChanged = options.onHealthChanged || (() => {});
    this.onScoreChanged = options.onScoreChanged || (() => {});
    this.onSpeedChanged = options.onSpeedChanged || (() => {});
    this.onComboMilestone = options.onComboMilestone || (() => {});
    this.onObstacleTriggered = options.onObstacleTriggered || (() => {});
    this.onShieldChanged = options.onShieldChanged || (() => {});

    this.reset();
  }

  reset() {
    this.score = 0;
    this.health = 100; // 5 segments: 100, 80, 60, 40, 20, 0
    this.speedMultiplier = 1.0;
    this.minSpeed = 1.0;
    this.maxSpeed = 2.0;

    this.streak = 0;
    this.maxStreak = 0;
    this.consecutiveMistakes = 0;

    this.correctCount = 0;
    this.wrongCount = 0;
    this.timeoutCount = 0;
    this.dataFragmentsCollected = 0;

    this.hasShield = false;
    this.isOverclocked = false;
    this.level = 1;

    // Track processed items to strictly prevent duplicate processing
    this.processedQuestionIds = new Set();
    this.collectedFragmentIds = new Set();

    this.notifyAll();
  }

  notifyAll() {
    this.onHealthChanged(this.health, false);
    this.onScoreChanged(this.score, this.speedMultiplier, 0);
    this.onSpeedChanged(this.speedMultiplier);
    this.onShieldChanged(this.hasShield);
  }

  // Returns effective multiplier (for HUD display/backward compatibility)
  getScoreMultiplier() {
    return 1.0;
  }

  // Authoritative Correct Answer scoring function
  awardCorrectAnswer(questionId = null) {
    if (questionId !== null && questionId !== undefined) {
      const qKey = String(questionId);
      if (this.processedQuestionIds.has(qKey)) {
        return null; // Prevent duplicate scoring of the same question
      }
      this.processedQuestionIds.add(qKey);
    }

    this.correctCount++;
    this.streak++;
    this.maxStreak = Math.max(this.maxStreak, this.streak);
    this.consecutiveMistakes = 0; // reset consecutive mistake counter
    this.wrongStreak = 0;

    // 1. Correct answer: +100 points
    let pointsAwarded = 100;

    // 4 & 5. Every 3 consecutive correct answers: +50 bonus points
    if (this.streak > 0 && this.streak % 3 === 0) {
      pointsAwarded += 50;
    }

    this.score = Math.max(0, this.score + pointsAwarded);

    // 8. Controlled movement speed boost up to max cap
    this.speedMultiplier = Math.min(this.maxSpeed, +(this.speedMultiplier + 0.05).toFixed(2));
    this.onSpeedChanged(this.speedMultiplier);

    // Milestone broadcast
    if (this.streak > 0 && this.streak % 3 === 0) {
      this.onComboMilestone(this.streak, `${this.streak}X STREAK // +50 BONUS POINTS!`);
    }

    this.onScoreChanged(this.score, this.speedMultiplier, pointsAwarded);
    return pointsAwarded;
  }

  // Backward compatibility alias for handleCorrectAnswer
  handleCorrectAnswer(arg1, arg2) {
    let questionId = null;
    if (typeof arg1 === 'object' && arg1 !== null) {
      questionId = arg1.questionId || arg1.id || (arg1.question && arg1.question.id) || null;
    } else if (typeof arg1 === 'string') {
      questionId = arg1;
    }
    return this.awardCorrectAnswer(questionId);
  }

  // Authoritative Wrong Answer & Timeout processing function
  handleMistake(arg1 = false, arg2 = null, applyHealthDamage = true) {
    let isTimeout = false;
    let questionId = null;

    if (typeof arg1 === 'object' && arg1 !== null) {
      questionId = arg1.questionId || arg1.id || (arg1.question && arg1.question.id) || null;
      isTimeout = Boolean(arg1.isTimeout);
    } else if (typeof arg1 === 'string') {
      questionId = arg1;
      isTimeout = Boolean(arg2);
    } else {
      isTimeout = Boolean(arg1);
      questionId = arg2;
    }

    if (questionId !== null && questionId !== undefined) {
      const qKey = String(questionId);
      if (this.processedQuestionIds.has(qKey)) {
        return null; // Ignore duplicate processing
      }
      this.processedQuestionIds.add(qKey);
    }

    if (isTimeout) {
      this.timeoutCount++;
    } else {
      this.wrongCount++;
    }

    // 6. Reset current streak to 0
    this.streak = 0;
    this.consecutiveMistakes++;
    this.wrongStreak = this.consecutiveMistakes;

    let damageBlocked = false;

    if (applyHealthDamage) {
      if (this.hasShield) {
        // Shield absorbs one damage instance
        this.hasShield = false;
        damageBlocked = true;
        this.onShieldChanged(false);
      } else {
        // 7. Health loss: reduce by 20% of maximum health (20 HP)
        this.health = Math.max(0, this.health - 20);
        this.onHealthChanged(this.health, true);
      }
    }

    // 9. Every two consecutive wrong answers: spawn one additional obstacle
    let obstacleTriggered = false;
    if (this.consecutiveMistakes >= 2) {
      this.consecutiveMistakes = 0;
      obstacleTriggered = true;
      this.onObstacleTriggered();
    }

    this.onScoreChanged(this.score, this.speedMultiplier, 0);

    return {
      damageBlocked,
      newHealth: this.health,
      isDead: this.health <= 0,
      obstacleTriggered
    };
  }

  // Handle wrong answer submitted early by player (zero points, streak reset, NO health damage)
  handleWrongAnswerEarly(questionId = null) {
    return this.handleMistake(false, questionId, false);
  }

  // Handle question timeout without enemy in danger radius (streak reset, timeout counted, NO health damage)
  handleTimeoutNoDamage(questionId = null) {
    return this.handleMistake(true, questionId, false);
  }

  // Handle question timeout with enemy in danger radius (streak reset, timeout counted, -20% health damage)
  handleTimeoutWithDamage(questionId = null) {
    return this.handleMistake(true, questionId, true);
  }

  handleEnemyCollision() {
    if (this.hasShield) {
      this.hasShield = false;
      this.onShieldChanged(false);
      return { damageBlocked: true, newHealth: this.health, isDead: false };
    }

    // Enemy collision causes 20% (20 HP) damage
    this.health = Math.max(0, this.health - 20);
    this.onHealthChanged(this.health, true);

    return {
      damageBlocked: false,
      newHealth: this.health,
      isDead: this.health <= 0
    };
  }

  get dataFragments() {
    return this.dataFragmentsCollected;
  }

  // Data Fragments: capped at 25 points per unique fragment, no duplicate scoring
  addFragmentScore(fragmentId = null, points = 25) {
    if (fragmentId !== null && fragmentId !== undefined) {
      const fKey = String(fragmentId);
      if (this.collectedFragmentIds.has(fKey)) {
        return { awarded: false, points: 0, valueOf() { return 0; } };
      }
      this.collectedFragmentIds.add(fKey);
    }

    this.dataFragmentsCollected++;
    const earned = Math.min(25, Math.max(0, points));
    this.score = Math.max(0, this.score + earned);
    this.onScoreChanged(this.score, this.speedMultiplier, earned);
    return { awarded: true, points: earned, valueOf() { return earned; } };
  }

  restoreHealth(amount = 20) {
    const prev = this.health;
    this.health = Math.min(100, this.health + amount);
    if (this.health !== prev) {
      this.onHealthChanged(this.health, false);
      return true;
    }
    return false;
  }

  grantShield() {
    this.hasShield = true;
    this.onShieldChanged(true);
  }

  activateOverclock(seconds = 8) {
    this.isOverclocked = true;
    this.speedMultiplier = Math.min(this.maxSpeed, +(this.speedMultiplier + 0.2).toFixed(2));
    this.onSpeedChanged(this.speedMultiplier);

    setTimeout(() => {
      this.isOverclocked = false;
      this.speedMultiplier = Math.max(this.minSpeed, +(this.speedMultiplier - 0.2).toFixed(2));
      this.onSpeedChanged(this.speedMultiplier);
    }, seconds * 1000);
  }

  isDead() {
    return this.health <= 0;
  }

  // Accuracy = (Correct Answers / Total Answered Questions) * 100, rounded to nearest whole percentage
  getAccuracy() {
    const totalAnswered = this.correctCount + this.wrongCount + this.timeoutCount;
    if (totalAnswered === 0) return 0;
    return Math.round((this.correctCount / totalAnswered) * 100);
  }

  getStatsSummary(survivalTimeSeconds = 120) {
    return {
      finalScore: this.score,
      health: this.health,
      correctCount: this.correctCount,
      wrongCount: this.wrongCount,
      timeoutCount: this.timeoutCount,
      totalMistakes: this.wrongCount + this.timeoutCount,
      accuracy: this.getAccuracy(),
      maxStreak: this.maxStreak,
      currentStreak: this.streak,
      dataFragments: this.dataFragmentsCollected,
      survivalTime: survivalTimeSeconds,
      level: 1 + Math.floor(this.correctCount / 4),
      isSurvived: this.health > 0 && survivalTimeSeconds >= 120
    };
  }
}
