import { audioManager } from '../systems/AudioManager.js';

export class QuestionPanel {
  constructor(options = {}) {
    this.onAnswerSelected = options.onAnswerSelected || (() => {});

    // Elements
    this.panelEl = document.querySelector('.question-terminal');
    this.badgeCat = document.getElementById('q-category');
    this.badgeDiff = document.getElementById('q-difficulty');
    this.qNumEl = document.getElementById('q-number');
    this.qTextEl = document.getElementById('q-text');
    this.codeSnippetEl = document.getElementById('q-code');
    this.timerFillEl = document.getElementById('q-timer-fill');
    this.answersGridEl = document.getElementById('q-answers');
    this.feedbackEl = document.getElementById('q-feedback');

    // Countdown Overlay Elements
    this.countdownOverlay = document.getElementById('q-countdown-overlay');
    this.countdownDigitEl = document.getElementById('countdown-digit');
    this.countdownGlitchEl = document.getElementById('countdown-glitch');
    this.countdownRingEl = document.getElementById('countdown-ring-fill');
    this.countdownOutcomeEl = document.getElementById('countdown-outcome-badge');

    this.currentQuestion = null;
    this.isLocked = false;

    // Reusable Countdown State
    this.countdownTimer = null;
    this.isCountdownActive = false;
    this.countdownCompleteCallback = null;
    this.currentCountdownStep = 3;
    this.isCountdownPaused = false;
    this.stepStartTime = 0;
    this.stepRemainingMs = 1000;

    this.bindKeyboard();
  }

  bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (this.isLocked || !this.currentQuestion) return;
      if (['1', '2', '3', '4'].includes(e.key)) {
        const index = parseInt(e.key, 10) - 1;
        this.selectOption(index);
      }
    });
  }

  setQuestion(data) {
    this.cancelCountdown();
    this.isLocked = false;
    this.currentQuestion = data.question;

    // Reset feedback & glow
    if (this.panelEl) {
      this.panelEl.classList.remove('correct-glow', 'wrong-glow');
    }
    if (this.feedbackEl) {
      this.feedbackEl.className = 'terminal-feedback';
      this.feedbackEl.textContent = '';
    }

    // Set Header
    if (this.badgeCat) {
      this.badgeCat.textContent = data.question.category;
      this.badgeCat.className = `badge-tag badge-${data.question.category.toLowerCase()}`;
    }
    if (this.badgeDiff) {
      this.badgeDiff.textContent = data.question.difficulty.toUpperCase();
    }
    if (this.qNumEl) {
      this.qNumEl.textContent = `Q#${data.questionNumber.toString().padStart(2, '0')}`;
    }

    // Set Text
    if (this.qTextEl) {
      this.qTextEl.textContent = data.question.question;
    }

    // Set Code Snippet
    if (this.codeSnippetEl) {
      if (data.question.code) {
        this.codeSnippetEl.textContent = data.question.code;
        this.codeSnippetEl.style.display = 'block';
      } else {
        this.codeSnippetEl.textContent = '';
        this.codeSnippetEl.style.display = 'none';
      }
    }

    // Render 4 answer buttons
    this.renderOptions(data.question.options);

    // Reset timer bar
    this.updateTimer(10, 1.0);
  }

  renderOptions(options) {
    if (!this.answersGridEl) return;
    this.answersGridEl.innerHTML = '';

    options.forEach((optText, idx) => {
      const btn = document.createElement('button');
      btn.className = 'btn-option';
      btn.dataset.index = idx;

      const badge = document.createElement('span');
      badge.className = 'key-badge';
      badge.textContent = `[${idx + 1}]`;

      const text = document.createElement('span');
      text.textContent = optText;

      btn.appendChild(badge);
      btn.appendChild(text);

      btn.addEventListener('mouseenter', () => {
        if (!this.isLocked) audioManager.playHover();
      });

      btn.addEventListener('click', () => {
        if (!this.isLocked) {
          this.selectOption(idx);
        }
      });

      this.answersGridEl.appendChild(btn);
    });
  }

  selectOption(index) {
    if (this.isLocked) return;
    this.isLocked = true;
    audioManager.playClick();
    this.onAnswerSelected(index);
  }

  updateTimer(remainingSeconds, ratio) {
    if (!this.timerFillEl) return;
    this.timerFillEl.style.width = `${Math.max(0, ratio * 100)}%`;

    if (remainingSeconds <= 3) {
      this.timerFillEl.classList.add('danger');
    } else {
      this.timerFillEl.classList.remove('danger');
    }
  }

  showFeedback(result) {
    this.isLocked = true;
    const buttons = this.answersGridEl ? this.answersGridEl.querySelectorAll('.btn-option') : [];

    const correctText = result.correctText || 
      (result.question && result.question.options ? result.question.options[result.correctIndex] : 
      (this.currentQuestion && this.currentQuestion.options ? this.currentQuestion.options[result.correctIndex] : ''));

    // Highlight selected in red and correct in green
    buttons.forEach((btn, idx) => {
      btn.disabled = true;
      const badge = btn.querySelector('.key-badge');
      if (idx === result.correctIndex) {
        btn.classList.add('correct');
        btn.classList.remove('wrong', 'dimmed');
        if (badge) badge.textContent = '✓';
      } else if (idx === result.selectedIndex) {
        btn.classList.add('wrong');
        btn.classList.remove('correct', 'dimmed');
        if (badge) badge.textContent = '✗';
      } else {
        btn.classList.add('dimmed');
        btn.classList.remove('correct', 'wrong');
      }
    });

    if (result.isCorrect) {
      audioManager.playCorrect();
      if (this.panelEl) {
        this.panelEl.classList.remove('wrong-glow');
        this.panelEl.classList.add('correct-glow');
      }
      if (this.feedbackEl) {
        this.feedbackEl.textContent = 'Correct! (+100 PTS)';
        this.feedbackEl.className = 'terminal-feedback visible correct';
      }
    } else {
      audioManager.playWrong();
      if (this.panelEl) {
        this.panelEl.classList.remove('correct-glow');
        this.panelEl.classList.add('wrong-glow');
      }
      if (this.feedbackEl) {
        const prefix = result.isTimeout ? "Time's up!" : 'Wrong!';
        this.feedbackEl.textContent = `${prefix} Correct answer: ${correctText}`;
        this.feedbackEl.className = 'terminal-feedback visible wrong';
      }
    }
  }

  // Full-Panel Animated Countdown: 3 -> 2 -> 1
  startCountdown(result, onComplete) {
    this.cancelCountdown();
    this.isLocked = true;
    this.isCountdownActive = true;
    this.isCountdownPaused = false;
    this.countdownCompleteCallback = onComplete;
    this.currentCountdownStep = 3;

    if (!this.countdownOverlay) {
      if (onComplete) onComplete();
      return;
    }

    const correctText = result.correctText || 
      (result.question && result.question.options ? result.question.options[result.correctIndex] : 
      (this.currentQuestion && this.currentQuestion.options ? this.currentQuestion.options[result.correctIndex] : ''));

    // Set Outcome Pill based on answer evaluation
    if (this.countdownOutcomeEl) {
      if (result && result.isCorrect) {
        this.countdownOutcomeEl.className = 'countdown-outcome correct';
        this.countdownOutcomeEl.textContent = '✓ CORRECT! (+100 PTS)';
      } else if (result && result.isTimeout) {
        this.countdownOutcomeEl.className = 'countdown-outcome timeout';
        this.countdownOutcomeEl.textContent = `⏱ TIME'S UP! Correct answer: ${correctText}`;
      } else {
        this.countdownOutcomeEl.className = 'countdown-outcome wrong';
        this.countdownOutcomeEl.textContent = `✗ WRONG! Correct answer: ${correctText}`;
      }
    }

    this.countdownOverlay.classList.remove('hidden', 'warp-out');

    // Safety watchdog: ensure callback is guaranteed to fire within 4.5s
    const watchdogId = setTimeout(() => {
      if (this.isCountdownActive && this.countdownCompleteCallback) {
        console.warn('Countdown safety watchdog triggered; advancing question.');
        const cb = this.countdownCompleteCallback;
        this.cancelCountdown();
        cb();
      }
    }, 4500);

    // Circumference of 64px radius SVG circle: 2 * PI * 64 ≈ 402.12
    const circumference = 402.12;

    const executeStep = () => {
      if (!this.isCountdownActive) {
        clearTimeout(watchdogId);
        return;
      }

      try {
        if (this.currentCountdownStep > 0) {
        const stepNum = this.currentCountdownStep;

        // Update Digit with re-triggered animation
        if (this.countdownDigitEl) {
          this.countdownDigitEl.textContent = stepNum;
          this.countdownDigitEl.classList.remove('countdown-tick-anim');
          void this.countdownDigitEl.offsetWidth; // Force CSS reflow
          this.countdownDigitEl.classList.add('countdown-tick-anim');
        }

        if (this.countdownGlitchEl) {
          this.countdownGlitchEl.textContent = stepNum;
        }

        // Circular Progress Ring animation
        if (this.countdownRingEl) {
          // step 3: 0 offset (full), step 2: 1/3 offset, step 1: 2/3 offset
          const offset = circumference * (1 - (stepNum / 3));
          this.countdownRingEl.style.strokeDashoffset = offset.toFixed(1);
        }

        // Audio synthesizer tick
        audioManager.playQuestionCountdownTick(stepNum);

        this.currentCountdownStep--;
        this.stepStartTime = Date.now();
        this.stepRemainingMs = 1000;

        this.countdownTimer = setTimeout(() => {
          if (this.isCountdownActive && !this.isCountdownPaused) {
            executeStep();
          }
        }, 1000);
      } else {
        // Countdown Finished (3 -> 2 -> 1 done)
        audioManager.playCountdownGo();

        if (this.countdownRingEl) {
          this.countdownRingEl.style.strokeDashoffset = `${circumference}`;
        }

        // Brief finish transition warp
        this.countdownOverlay.classList.add('warp-out');

        this.countdownTimer = setTimeout(() => {
          this.isCountdownActive = false;
          this.hideCountdown();
          clearTimeout(watchdogId);
          if (this.countdownCompleteCallback) {
            const cb = this.countdownCompleteCallback;
            this.countdownCompleteCallback = null;
            cb();
          }
        }, 180);
      }
    } catch (err) {
      console.warn('Countdown execution error, advancing question immediately:', err);
      clearTimeout(watchdogId);
      this.isCountdownActive = false;
      this.hideCountdown();
      if (this.countdownCompleteCallback) {
        const cb = this.countdownCompleteCallback;
        this.countdownCompleteCallback = null;
        cb();
      }
    }
  };

  executeStep();
}

  cancelCountdown() {
    this.isCountdownActive = false;
    this.isCountdownPaused = false;
    if (this.countdownTimer) {
      clearTimeout(this.countdownTimer);
      this.countdownTimer = null;
    }
    this.countdownCompleteCallback = null;
    this.hideCountdown();
  }

  pauseCountdown() {
    if (!this.isCountdownActive || this.isCountdownPaused) return;
    this.isCountdownPaused = true;
    if (this.countdownTimer) {
      clearTimeout(this.countdownTimer);
      this.countdownTimer = null;
    }
    const elapsed = Date.now() - this.stepStartTime;
    this.stepRemainingMs = Math.max(100, this.stepRemainingMs - elapsed);
  }

  resumeCountdown() {
    if (!this.isCountdownActive || !this.isCountdownPaused) return;
    this.isCountdownPaused = false;
    this.stepStartTime = Date.now();

    this.countdownTimer = setTimeout(() => {
      if (this.isCountdownActive && !this.isCountdownPaused) {
        // Continue to next countdown step
        this.continueStep();
      }
    }, this.stepRemainingMs);
  }

  continueStep() {
    if (!this.isCountdownActive) return;
    const circumference = 402.12;

    if (this.currentCountdownStep > 0) {
      const stepNum = this.currentCountdownStep;
      if (this.countdownDigitEl) {
        this.countdownDigitEl.textContent = stepNum;
        this.countdownDigitEl.classList.remove('countdown-tick-anim');
        void this.countdownDigitEl.offsetWidth;
        this.countdownDigitEl.classList.add('countdown-tick-anim');
      }
      if (this.countdownGlitchEl) {
        this.countdownGlitchEl.textContent = stepNum;
      }
      if (this.countdownRingEl) {
        const offset = circumference * (1 - (stepNum / 3));
        this.countdownRingEl.style.strokeDashoffset = offset.toFixed(1);
      }
      audioManager.playQuestionCountdownTick(stepNum);

      this.currentCountdownStep--;
      this.stepStartTime = Date.now();
      this.stepRemainingMs = 1000;

      this.countdownTimer = setTimeout(() => {
        if (this.isCountdownActive && !this.isCountdownPaused) {
          this.continueStep();
        }
      }, 1000);
    } else {
      audioManager.playCountdownGo();
      if (this.countdownOverlay) {
        this.countdownOverlay.classList.add('warp-out');
      }
      this.countdownTimer = setTimeout(() => {
        this.isCountdownActive = false;
        this.hideCountdown();
        if (this.countdownCompleteCallback) {
          const cb = this.countdownCompleteCallback;
          this.countdownCompleteCallback = null;
          cb();
        }
      }, 180);
    }
  }

  hideCountdown() {
    if (this.countdownOverlay) {
      this.countdownOverlay.classList.add('hidden');
      this.countdownOverlay.classList.remove('warp-out');
    }
  }
}
