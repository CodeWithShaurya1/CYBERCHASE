// Smart Question Engine with Deficit-Based Weighted Scheduling & Option Shuffling
// Target Distribution: 42% Python, 33% HTML, 25% CSS
import { generateFullQuestionBank, shuffleQuestionOptions } from '../data/questions.js';

export const TARGET_DISTRIBUTION = {
  PYTHON: 0.42,
  HTML: 0.33,
  CSS: 0.25
};

export class QuestionEngine {
  constructor(options = {}) {
    this.onQuestionChanged = options.onQuestionChanged || (() => {});
    this.onAnswerEvaluated = options.onAnswerEvaluated || (() => {});
    this.onTimerTick = options.onTimerTick || (() => {});
    this.onTimeout = options.onTimeout || (() => {});

    // Complete library of questions categorized
    this.allQuestions = [];
    this.questionsByCategory = {
      PYTHON: [],
      HTML: [],
      CSS: []
    };

    // Session-specific tracking
    this.usedQuestionIds = new Set();
    this.categoryCounts = { PYTHON: 0, HTML: 0, CSS: 0 };
    this.totalServed = 0;
    this.lastCategory = null;

    this.currentQuestion = null;
    this.currentQuestionNumber = 0;
    this.isAnsweringAllowed = false;

    // Timer (10 seconds per question)
    this.questionDuration = 10;
    this.remainingSeconds = 10;
    this.timerInterval = null;
    this.isPaused = false;

    this.initBank();
  }

  // Load and categorize all questions
  initBank() {
    this.allQuestions = generateFullQuestionBank();
    this.categorizeQuestions();
    this.resetSession();
  }

  categorizeQuestions() {
    this.questionsByCategory = {
      PYTHON: [],
      HTML: [],
      CSS: []
    };

    this.allQuestions.forEach(q => {
      const cat = (q.category || 'PYTHON').toUpperCase();
      if (this.questionsByCategory[cat]) {
        this.questionsByCategory[cat].push(q);
      } else {
        this.questionsByCategory.PYTHON.push(q);
      }
    });
  }

  // Reset all session-specific tracking (Called when starting a new player's run)
  resetSession() {
    this.clearIntervalTimer();
    this.usedQuestionIds.clear();
    this.categoryCounts = { PYTHON: 0, HTML: 0, CSS: 0 };
    this.totalServed = 0;
    this.lastCategory = null;
    this.currentQuestion = null;
    this.currentQuestionNumber = 0;
    this.isAnsweringAllowed = false;
    this.isPaused = false;
  }

  // Backward compatibility alias
  resetPool() {
    this.resetSession();
  }

  start() {
    this.resetSession();
    this.nextQuestion();
  }

  stop() {
    this.clearIntervalTimer();
    this.isAnsweringAllowed = false;
  }

  pause() {
    this.isPaused = true;
    this.clearIntervalTimer();
  }

  resume() {
    if (!this.isPaused || !this.currentQuestion || !this.isAnsweringAllowed) return;
    this.isPaused = false;
    this.startIntervalTimer();
  }

  clearIntervalTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  startIntervalTimer() {
    this.clearIntervalTimer();
    this.timerInterval = setInterval(() => {
      if (this.isPaused) return;
      this.remainingSeconds -= 0.1;

      if (this.remainingSeconds <= 0.05) {
        this.remainingSeconds = 0;
        this.clearIntervalTimer();
        this.onTimerTick(0, 0);
        this.handleTimeout();
      } else {
        const ratio = this.remainingSeconds / this.questionDuration;
        this.onTimerTick(this.remainingSeconds, ratio);
      }
    }, 100);
  }

  // Deficit-based scheduling algorithm: calculates deficits toward 42% Python, 33% HTML, 25% CSS
  getBestCategory() {
    const categories = ['PYTHON', 'HTML', 'CSS'];

    // Filter categories that have at least one unused question
    const eligibleCategories = categories.filter(cat => {
      const unusedCount = this.questionsByCategory[cat].filter(q => !this.usedQuestionIds.has(q.id)).length;
      return unusedCount > 0;
    });

    // If all questions in all categories are exhausted, reset the pool
    if (eligibleCategories.length === 0) {
      console.warn('⚡ Entire question bank exhausted! Resetting used question history.');
      this.usedQuestionIds.clear();
      return this.getBestCategory();
    }

    const nextTotal = this.totalServed + 1;

    // Calculate score for each eligible category
    // Score = Deficit - (Anti-consecutive penalty if same as last category)
    let bestCat = eligibleCategories[0];
    let highestScore = -Infinity;

    eligibleCategories.forEach(cat => {
      const targetRatio = TARGET_DISTRIBUTION[cat];
      const expectedCount = nextTotal * targetRatio;
      const actualCount = this.categoryCounts[cat];
      const deficit = expectedCount - actualCount;

      // Anti-consecutive penalty: penalize consecutive repeats by 0.35 unless deficit demands it
      const isConsecutive = (cat === this.lastCategory && eligibleCategories.length > 1);
      const score = deficit - (isConsecutive ? 0.35 : 0.0);

      if (score > highestScore) {
        highestScore = score;
        bestCat = cat;
      }
    });

    return bestCat;
  }

  // Select next question without repetition and shuffle answer options
  selectNextQuestion() {
    const chosenCategory = this.getBestCategory();
    const availablePool = this.questionsByCategory[chosenCategory].filter(q => !this.usedQuestionIds.has(q.id));

    // Randomize selection within available category pool
    const selectedQuestion = availablePool[Math.floor(Math.random() * availablePool.length)];

    // Mark as used
    this.usedQuestionIds.add(selectedQuestion.id);
    this.categoryCounts[chosenCategory]++;
    this.totalServed++;
    this.lastCategory = chosenCategory;

    // Shuffle options so correct answer is randomly positioned
    return shuffleQuestionOptions(selectedQuestion);
  }

  nextQuestion() {
    this.clearIntervalTimer();
    this.currentQuestionNumber++;
    this.currentQuestion = this.selectNextQuestion();
    this.remainingSeconds = this.questionDuration;
    this.isAnsweringAllowed = true;

    this.onQuestionChanged({
      questionNumber: this.currentQuestionNumber,
      question: this.currentQuestion,
      duration: this.questionDuration,
      remainingSeconds: this.remainingSeconds,
      categoryDistribution: this.getDistributionStats()
    });

    this.startIntervalTimer();
  }

  submitAnswer(selectedIndex) {
    if (!this.isAnsweringAllowed || !this.currentQuestion) return null;
    this.isAnsweringAllowed = false;
    this.clearIntervalTimer();

    const isCorrect = selectedIndex === this.currentQuestion.correct;
    const timeTaken = Math.max(0.1, +(this.questionDuration - this.remainingSeconds).toFixed(2));

    const result = {
      isCorrect,
      selectedIndex,
      correctIndex: this.currentQuestion.correct,
      correctText: this.currentQuestion.correctText,
      timeTaken,
      question: this.currentQuestion,
      isTimeout: false
    };

    this.onAnswerEvaluated(result);
    return result;
  }

  handleTimeout() {
    if (!this.isAnsweringAllowed || !this.currentQuestion) return;
    this.isAnsweringAllowed = false;

    const result = {
      isCorrect: false,
      selectedIndex: -1,
      correctIndex: this.currentQuestion.correct,
      correctText: this.currentQuestion.correctText,
      timeTaken: this.questionDuration,
      question: this.currentQuestion,
      isTimeout: true
    };

    this.onTimeout(result);
    this.onAnswerEvaluated(result);
  }

  getDistributionStats() {
    const total = Math.max(1, this.totalServed);
    return {
      total: this.totalServed,
      python: { count: this.categoryCounts.PYTHON, pct: Math.round((this.categoryCounts.PYTHON / total) * 100) },
      html: { count: this.categoryCounts.HTML, pct: Math.round((this.categoryCounts.HTML / total) * 100) },
      css: { count: this.categoryCounts.CSS, pct: Math.round((this.categoryCounts.CSS / total) * 100) }
    };
  }
}
