import { audioManager } from '../systems/AudioManager.js';

export class MainMenu {
  constructor(options = {}) {
    this.onStartRequested = options.onStartRequested || (() => {});
    this.onLeaderboardRequested = options.onLeaderboardRequested || (() => {});
    this.onHelpRequested = options.onHelpRequested || (() => {});
    this.onMuteToggled = options.onMuteToggled || (() => {});
    this.onChangePlayer = options.onChangePlayer || (() => {});

    this.menuScreen = document.getElementById('screen-menu');
    this.btnStart = document.getElementById('btn-menu-start');
    this.btnHelp = document.getElementById('btn-menu-help');
    this.btnLeaderboard = document.getElementById('btn-menu-leaderboard');
    this.btnSound = document.getElementById('btn-menu-sound');
    this.btnFullscreen = document.getElementById('btn-menu-fullscreen');
    this.btnChangePlayer = document.getElementById('btn-menu-change-player');
    this.playerBadge = document.getElementById('menu-player-badge');

    this.countdownOverlay = document.getElementById('overlay-countdown');
    this.countdownNumber = document.getElementById('countdown-val');

    this.bindEvents();
  }

  bindEvents() {
    if (this.btnStart) {
      this.btnStart.addEventListener('mouseenter', () => audioManager.playHover());
      this.btnStart.addEventListener('click', () => {
        audioManager.playBoot();
        this.triggerStartSequence();
      });
    }

    if (this.btnHelp) {
      this.btnHelp.addEventListener('mouseenter', () => audioManager.playHover());
      this.btnHelp.addEventListener('click', () => {
        audioManager.playClick();
        this.onHelpRequested();
      });
    }

    if (this.btnLeaderboard) {
      this.btnLeaderboard.addEventListener('mouseenter', () => audioManager.playHover());
      this.btnLeaderboard.addEventListener('click', () => {
        audioManager.playClick();
        this.onLeaderboardRequested();
      });
    }

    if (this.btnChangePlayer) {
      this.btnChangePlayer.addEventListener('click', () => {
        audioManager.playClick();
        this.hide();
        this.onChangePlayer();
      });
    }

    if (this.btnSound) {
      this.btnSound.addEventListener('click', () => {
        const isMuted = audioManager.toggleMute();
        this.updateSoundIcon(isMuted);
        this.onMuteToggled(isMuted);
      });
    }

    if (this.btnFullscreen) {
      this.btnFullscreen.addEventListener('click', () => {
        audioManager.playClick();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }
  }

  setPlayer(player) {
    if (this.playerBadge) {
      if (player && player.fullName) {
        this.playerBadge.textContent = `OPERATOR: ${player.fullName} [${player.enrollmentNumber}]`;
        this.playerBadge.style.display = 'inline-flex';
      } else {
        this.playerBadge.style.display = 'none';
      }
    }
  }

  updateSoundIcon(isMuted) {
    if (this.btnSound) {
      this.btnSound.textContent = isMuted ? '🔇 SOUND OFF' : '🔊 SOUND ON';
    }
  }

  show() {
    if (this.menuScreen) {
      this.menuScreen.classList.remove('hidden');
    }
  }

  hide() {
    if (this.menuScreen) {
      this.menuScreen.classList.add('hidden');
    }
  }

  triggerStartSequence() {
    this.hide();

    // 3, 2, 1, RUN! countdown sequence
    if (this.countdownOverlay && this.countdownNumber) {
      this.countdownOverlay.classList.remove('hidden');

      let count = 3;
      this.countdownNumber.textContent = count;
      audioManager.playCountdownTick(3);

      const interval = setInterval(() => {
        count--;
        if (count > 0) {
          this.countdownNumber.textContent = count;
          audioManager.playCountdownTick(count);
        } else if (count === 0) {
          this.countdownNumber.textContent = 'RUN!';
          audioManager.playCorrect();
        } else {
          clearInterval(interval);
          this.countdownOverlay.classList.add('hidden');
          this.onStartRequested();
        }
      }, 850);
    } else {
      this.onStartRequested();
    }
  }
}
