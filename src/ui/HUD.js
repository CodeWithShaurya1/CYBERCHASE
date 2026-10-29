import { audioManager } from '../systems/AudioManager.js';

export class HUD {
  constructor(options = {}) {
    this.onPauseClicked = options.onPauseClicked || (() => {});
    this.onMuteToggled = options.onMuteToggled || (() => {});
    this.onFullscreenToggled = options.onFullscreenToggled || (() => {});

    // DOM Elements
    this.timeEl = document.getElementById('hud-time');
    this.scoreEl = document.getElementById('hud-score');
    this.streakEl = document.getElementById('hud-streak');
    this.speedEl = document.getElementById('hud-speed');
    this.shieldBadge = document.getElementById('hud-shield');
    this.playerNameEl = document.getElementById('hud-player-name');
    this.btnPause = document.getElementById('btn-hud-pause');
    this.btnMute = document.getElementById('btn-hud-mute');
    this.btnFullscreen = document.getElementById('btn-hud-fullscreen');
    this.healthValEl = document.getElementById('hud-health-val');
    this.healthSegments = document.querySelectorAll('.health-cherry, .health-segment');
    this.previousHealthPercent = 100;

    this.displayedScore = 0;
    this.targetScore = 0;
    this.scoreAnimFrame = null;

    this.bindEvents();
  }

  setPlayer(player) {
    if (this.playerNameEl) {
      this.playerNameEl.textContent = player && player.fullName ? player.fullName : 'OPERATOR';
    }
  }

  bindEvents() {
    if (this.btnPause) {
      this.btnPause.addEventListener('click', () => {
        audioManager.playClick();
        this.onPauseClicked();
      });
    }

    if (this.btnMute) {
      this.btnMute.addEventListener('click', () => {
        const isMuted = audioManager.toggleMute();
        this.updateMuteIcon(isMuted);
        this.onMuteToggled(isMuted);
      });
    }

    if (this.btnFullscreen) {
      this.btnFullscreen.addEventListener('click', () => {
        audioManager.playClick();
        this.toggleFullscreen();
      });
    }
  }

  updateMuteIcon(isMuted) {
    if (this.btnMute) {
      this.btnMute.textContent = isMuted ? '🔇' : '🔊';
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  updateTime(secondsLeft) {
    if (!this.timeEl) return;
    const mins = Math.floor(secondsLeft / 60);
    const secs = Math.floor(secondsLeft % 60);
    this.timeEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    if (secondsLeft <= 10) {
      this.timeEl.classList.add('danger');
      // Final 10 seconds tension tick
      audioManager.playCountdownTick(secondsLeft);
    } else {
      this.timeEl.classList.remove('danger');
    }
  }

  updateScore(newScore) {
    this.targetScore = newScore;
    this.animateScore();
  }

  animateScore() {
    if (this.scoreAnimFrame) cancelAnimationFrame(this.scoreAnimFrame);

    const step = () => {
      const diff = this.targetScore - this.displayedScore;
      if (Math.abs(diff) <= 5) {
        this.displayedScore = this.targetScore;
        if (this.scoreEl) this.scoreEl.textContent = this.displayedScore.toLocaleString();
        return;
      }
      this.displayedScore += Math.ceil(diff * 0.2);
      if (this.scoreEl) this.scoreEl.textContent = this.displayedScore.toLocaleString();
      this.scoreAnimFrame = requestAnimationFrame(step);
    };

    this.scoreAnimFrame = requestAnimationFrame(step);
  }

  updateHealth(healthPercent, isDamage = false) {
    const clampedHealth = Math.max(0, Math.min(100, Math.round(healthPercent)));
    // 5 cherries: 100%, 80%, 60%, 40%, 20%, 0%
    const activeCherriesCount = Math.max(0, Math.min(5, Math.round(clampedHealth / 20)));

    // Update numerical percentage text immediately
    if (this.healthValEl) {
      this.healthValEl.textContent = `${clampedHealth}%`;
      if (clampedHealth <= 40) {
        this.healthValEl.classList.add('low');
      } else {
        this.healthValEl.classList.remove('low');
      }
    }

    const cherries = (this.healthSegments && this.healthSegments.length > 0)
      ? this.healthSegments
      : document.querySelectorAll('.health-cherry, .health-segment');

    cherries.forEach((cherry, idx) => {
      if (idx < activeCherriesCount) {
        cherry.classList.add('active');
        cherry.classList.remove('depleted');
        cherry.classList.remove('bursting');
      } else {
        const wasActive = cherry.classList.contains('active');
        cherry.classList.remove('active');
        cherry.classList.add('depleted');

        // Animate the lost cherry breaking / bursting on damage
        if (isDamage && wasActive && idx === activeCherriesCount) {
          cherry.classList.add('bursting');
          setTimeout(() => {
            cherry.classList.remove('bursting');
          }, 450);
        }
      }
    });

    if (isDamage) {
      const hudBar = document.querySelector('.hud-bar');
      if (hudBar) {
        hudBar.classList.add('glitch-shake');
        setTimeout(() => hudBar.classList.remove('glitch-shake'), 350);
      }
      const healthMeter = document.querySelector('.health-meter');
      if (healthMeter) {
        healthMeter.classList.add('damage-flash');
        setTimeout(() => healthMeter.classList.remove('damage-flash'), 350);
      }
    }

    this.previousHealthPercent = clampedHealth;
  }

  updateSpeed(multiplier) {
    if (this.speedEl) {
      this.speedEl.textContent = `${multiplier.toFixed(1)}x`;
    }
  }

  updateStreak(streak) {
    if (this.streakEl) {
      this.streakEl.textContent = `${streak}🔥`;
      if (streak >= 3) {
        this.streakEl.classList.add('combo-badge');
      } else {
        this.streakEl.classList.remove('combo-badge');
      }
    }
  }

  updateShield(hasShield) {
    if (this.shieldBadge) {
      if (hasShield) {
        this.shieldBadge.classList.add('visible');
      } else {
        this.shieldBadge.classList.remove('visible');
      }
    }
  }
}
