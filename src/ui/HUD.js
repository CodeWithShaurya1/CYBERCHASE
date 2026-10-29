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
    this.healthSegments = document.querySelectorAll('.health-segment');

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
    // 5 segments: 100%, 80%, 60%, 40%, 20%, 0%
    const activeSegmentsCount = Math.max(0, Math.min(5, Math.round(healthPercent / 20)));

    this.healthSegments.forEach((seg, idx) => {
      if (idx < activeSegmentsCount) {
        seg.classList.add('active');
        seg.classList.remove('depleted');
        seg.classList.remove('danger');
      } else {
        seg.classList.remove('active');
        seg.classList.add('depleted');
        seg.classList.remove('danger');
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
