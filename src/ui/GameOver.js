import confetti from 'canvas-confetti';
import { audioManager } from '../systems/AudioManager.js';
import { storageManager } from '../systems/StorageManager.js';

export class GameOver {
  constructor(options = {}) {
    this.onNextPlayer = options.onNextPlayer || (() => {});
    this.onPlayAgain = options.onPlayAgain || (() => {});
    this.onViewLeaderboard = options.onViewLeaderboard || (() => {});
    this.onReturnMenu = options.onReturnMenu || (() => {});

    // Elements
    this.screenEl = document.getElementById('screen-gameover');
    this.titleEl = document.getElementById('go-title');
    this.playerBadgeEl = document.getElementById('go-player-badge');
    this.scoreValEl = document.getElementById('go-score');
    this.statAccuracyEl = document.getElementById('go-stat-acc');
    this.statStreakEl = document.getElementById('go-stat-streak');
    this.statCorrectEl = document.getElementById('go-stat-correct');
    this.statWrongEl = document.getElementById('go-stat-wrong');
    this.statFragmentsEl = document.getElementById('go-stat-fragments');
    this.statTimeEl = document.getElementById('go-stat-time');
    this.statRankEl = document.getElementById('go-stat-rank');

    this.submitStatus = document.getElementById('go-submit-status');

    this.btnNextPlayer = document.getElementById('go-btn-next-player');
    this.btnPlayAgain = document.getElementById('go-btn-playagain');
    this.btnLeaderboard = document.getElementById('go-btn-leaderboard');
    this.btnMenu = document.getElementById('go-btn-menu');

    this.lastStats = null;
    this.currentSessionId = null;
    this.currentPlayer = null;

    this.bindEvents();
  }

  bindEvents() {
    if (this.btnNextPlayer) {
      this.btnNextPlayer.addEventListener('mouseenter', () => audioManager.playHover());
      this.btnNextPlayer.addEventListener('click', () => {
        audioManager.playClick();
        this.hide();
        this.onNextPlayer();
      });
    }

    if (this.btnPlayAgain) {
      this.btnPlayAgain.addEventListener('mouseenter', () => audioManager.playHover());
      this.btnPlayAgain.addEventListener('click', () => {
        audioManager.playClick();
        this.hide();
        this.onPlayAgain();
      });
    }

    if (this.btnLeaderboard) {
      this.btnLeaderboard.addEventListener('mouseenter', () => audioManager.playHover());
      this.btnLeaderboard.addEventListener('click', () => {
        audioManager.playClick();
        this.onViewLeaderboard();
      });
    }

    if (this.btnMenu) {
      this.btnMenu.addEventListener('mouseenter', () => audioManager.playHover());
      this.btnMenu.addEventListener('click', () => {
        audioManager.playClick();
        this.hide();
        this.onReturnMenu();
      });
    }
  }

  async show(stats, sessionId, player) {
    this.lastStats = stats;
    this.currentSessionId = sessionId;
    this.currentPlayer = player || { fullName: 'OPERATOR', enrollmentNumber: 'N/A' };

    if (this.screenEl) {
      this.screenEl.classList.remove('hidden');
    }

    // Play appropriate sound & effects
    audioManager.playGameOver(stats.isSurvived);

    if (stats.isSurvived) {
      if (this.titleEl) {
        this.titleEl.textContent = 'SYSTEM SURVIVED // TIME EXPIRED';
        this.titleEl.className = 'gameover-title survived';
      }
      try {
        confetti({
          particleCount: 90,
          spread: 75,
          origin: { y: 0.6 }
        });
      } catch (_) {}
    } else {
      if (this.titleEl) {
        this.titleEl.textContent = 'GAME OVER // RUN TERMINATED';
        this.titleEl.className = 'gameover-title terminated';
      }
    }

    // Render player badge
    if (this.playerBadgeEl) {
      this.playerBadgeEl.textContent = `OPERATOR: ${this.currentPlayer.fullName} | ENROLLMENT: ${this.currentPlayer.enrollmentNumber}`;
    }

    // Render stats
    if (this.scoreValEl) this.scoreValEl.textContent = stats.finalScore.toLocaleString();
    if (this.statAccuracyEl) this.statAccuracyEl.textContent = `${stats.accuracy}%`;
    if (this.statStreakEl) this.statStreakEl.textContent = `${stats.maxStreak}x`;
    if (this.statCorrectEl) this.statCorrectEl.textContent = `${stats.correctCount}`;
    if (this.statWrongEl) this.statWrongEl.textContent = `${stats.wrongCount + stats.timeoutCount}`;
    if (this.statFragmentsEl) this.statFragmentsEl.textContent = `${stats.dataFragments}`;
    if (this.statTimeEl) this.statTimeEl.textContent = `${stats.survivalTime}s`;

    // Automatically submit score with registration details
    await this.autoSubmitScore();
  }

  async autoSubmitScore() {
    if (!this.lastStats || !this.currentSessionId || !this.currentPlayer) return;

    if (this.submitStatus) {
      this.submitStatus.textContent = 'TRANSMITTING TELEMETRY TO LEADERBOARD...';
      this.submitStatus.style.color = '#00f5ff';
    }

    const res = await storageManager.submitScore({
      name: this.currentPlayer.fullName,
      enrollment: this.currentPlayer.enrollmentNumber,
      score: this.lastStats.finalScore,
      accuracy: this.lastStats.accuracy,
      correct_answers: this.lastStats.correctCount,
      wrong_answers: this.lastStats.wrongCount + this.lastStats.timeoutCount,
      streak: this.lastStats.maxStreak,
      fragments: this.lastStats.dataFragments
    }, this.currentSessionId);

    if (res.success) {
      const rankDisplay = typeof res.rank === 'number' ? `#${res.rank}` : (String(res.rank).startsWith('#') ? res.rank : `#${res.rank}`);
      if (this.statRankEl) {
        this.statRankEl.textContent = rankDisplay;
      }
      if (this.submitStatus) {
        const sourceLabel = res.source === 'cloud' ? 'SHARED EVENT CLOUD' : 'LOCAL TERMINAL ARCHIVE';
        this.submitStatus.innerHTML = `✓ SCORE RECORDED TO <strong style="color:#00f5ff;">${sourceLabel}</strong> — RANK <strong style="color:#39ff88;">${rankDisplay}</strong>`;
        this.submitStatus.style.color = '#39ff88';
      }
    } else {
      if (this.statRankEl) {
        this.statRankEl.textContent = 'COMPLETED';
      }
      if (this.submitStatus) {
        this.submitStatus.textContent = 'SESSION RESULTS LOGGED';
        this.submitStatus.style.color = '#9299b5';
      }
    }
  }

  hide() {
    if (this.screenEl) {
      this.screenEl.classList.add('hidden');
    }
  }
}
