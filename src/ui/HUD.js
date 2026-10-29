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
    this.healthBarFill = document.getElementById('hud-health-fill');
    this.healthCheckpoints = document.querySelectorAll('.health-checkpoint');
    this.healthTicks = document.querySelectorAll('.health-tick');
    this.healthFloaterContainer = document.getElementById('hud-health-floater-container');
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

    // 1. Update numerical percentage text immediately
    const valEl = this.healthValEl || document.getElementById('hud-health-val');
    if (valEl) {
      valEl.textContent = `${clampedHealth}%`;
      if (clampedHealth <= 40) {
        valEl.classList.add('low');
      } else {
        valEl.classList.remove('low');
      }
    }

    // 2. Animate the glowing neon fill shrinking smoothly to the next checkpoint
    const fillEl = this.healthBarFill || document.getElementById('hud-health-fill');
    if (fillEl) {
      fillEl.style.width = `${clampedHealth}%`;
      if (clampedHealth <= 40) {
        fillEl.classList.add('danger');
      } else {
        fillEl.classList.remove('danger');
      }
    }

    // 3. Update Checkpoint Markers (20%, 40%, 60%, 80%)
    const checkpoints = (this.healthCheckpoints && this.healthCheckpoints.length > 0)
      ? this.healthCheckpoints
      : document.querySelectorAll('.health-checkpoint');

    checkpoints.forEach(cp => {
      const val = parseInt(cp.getAttribute('data-val'), 10);
      if (val <= clampedHealth) {
        cp.classList.add('active');
        cp.classList.remove('depleted');
      } else {
        cp.classList.remove('active');
        cp.classList.add('depleted');
      }
    });

    // 4. Update Subtle Ticks below the bar (0%, 20, 40, 60, 80, 100%)
    const ticks = (this.healthTicks && this.healthTicks.length > 0)
      ? this.healthTicks
      : document.querySelectorAll('.health-tick');

    ticks.forEach(tick => {
      const val = parseInt(tick.getAttribute('data-val'), 10);
      if (val <= clampedHealth) {
        tick.classList.add('active');
      } else {
        tick.classList.remove('active');
      }
    });

    // 5. On damage: display floating "-20% HEALTH", highlight checkpoint reached, and flash
    if (isDamage) {
      // Highlight the checkpoint reached after damage
      checkpoints.forEach(cp => {
        const val = parseInt(cp.getAttribute('data-val'), 10);
        if (val === clampedHealth) {
          cp.classList.add('highlight-pulse');
          setTimeout(() => cp.classList.remove('highlight-pulse'), 600);
        }
      });

      // Highlight the corresponding tick mark reached
      ticks.forEach(tick => {
        const val = parseInt(tick.getAttribute('data-val'), 10);
        if (val === clampedHealth) {
          tick.classList.add('highlight-hit');
          setTimeout(() => tick.classList.remove('highlight-hit'), 600);
        }
      });

      // Briefly display a floating red "-20% HEALTH" message above/beside the bar
      const floaterContainer = this.healthFloaterContainer || document.getElementById('hud-health-floater-container');
      if (floaterContainer && typeof document !== 'undefined' && document.createElement) {
        const popup = document.createElement('div');
        popup.className = 'health-damage-popup';
        popup.textContent = '−20% HEALTH';
        floaterContainer.appendChild(popup);
        setTimeout(() => popup.remove(), 750);
      }

      // HUD glitch shake & red damage flash on health meter
      if (typeof document !== 'undefined') {
        const hudBar = document.querySelector('.hud-bar');
        if (hudBar) {
          hudBar.classList.add('glitch-shake');
          setTimeout(() => hudBar.classList.remove('glitch-shake'), 350);
        }
        const healthMeter = document.getElementById('health-meter') || document.querySelector('.health-meter');
        if (healthMeter) {
          healthMeter.classList.add('damage-flash');
          setTimeout(() => healthMeter.classList.remove('damage-flash'), 350);
        }
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
