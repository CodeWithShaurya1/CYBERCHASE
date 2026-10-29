import Phaser from 'phaser';
import { GameScene } from './game/GameScene.js';
import { audioManager } from './systems/AudioManager.js';
import { ScoreManager } from './systems/ScoreManager.js';
import { QuestionEngine } from './systems/QuestionEngine.js';
import { Registration } from './ui/Registration.js';
import { HUD } from './ui/HUD.js';
import { QuestionPanel } from './ui/QuestionPanel.js';
import { MainMenu } from './ui/MainMenu.js';
import { GameOver } from './ui/GameOver.js';
import { Leaderboard } from './ui/Leaderboard.js';
import { storageManager } from './systems/StorageManager.js';

class CyberchaseApp {
  constructor() {
    this.phaserGame = null;
    this.gameScene = null;

    this.scoreManager = null;
    this.questionEngine = null;

    this.registrationUI = null;
    this.hud = null;
    this.questionPanel = null;
    this.mainMenu = null;
    this.gameOverUI = null;
    this.leaderboardUI = null;

    this.currentPlayer = null;

    // 120-second master session timer
    this.sessionDuration = 120;
    this.sessionRemaining = 120;
    this.sessionInterval = null;
    this.isGameActive = false;
    this.isPaused = false;
    this.currentSessionId = null;

    this.initMatrixRain();
    this.initGameSystems();
    this.initPhaser();
    this.initUI();
    this.bindPauseAndGlobalEvents();
  }

  // 1. Cyberpunk Digital Rain background effect
  initMatrixRain() {
    const canvas = document.getElementById('canvas-matrix');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const chars = '01CYBERCHASE_TECHVERSE<>{}/*+=!#010101';
    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);
    const drops = Array(columns).fill(1);

    const draw = () => {
      ctx.fillStyle = 'rgba(5, 6, 17, 0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#00f5ff';
      ctx.font = `${fontSize}px 'JetBrains Mono', monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        ctx.fillText(text, x, y);

        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    setInterval(draw, 40);
  }

  // 2. Systems Setup
  initGameSystems() {
    // Score & Health Manager
    this.scoreManager = new ScoreManager({
      onHealthChanged: (health, isDamage) => {
        if (this.hud) this.hud.updateHealth(health, isDamage);
        if (health <= 0 && this.isGameActive) {
          this.endGameRun(false); // Health depleted!
        }
      },
      onScoreChanged: (score, mult) => {
        if (this.hud) this.hud.updateScore(score);
      },
      onSpeedChanged: (mult) => {
        if (this.hud) this.hud.updateSpeed(mult);
        if (this.gameScene && this.gameScene.player) {
          this.gameScene.player.setSpeedMultiplier(mult);
        }
      },
      onComboMilestone: (streak, message) => {
        audioManager.playCombo();
        if (this.gameScene && this.gameScene.particleEffects && this.gameScene.player) {
          this.gameScene.particleEffects.spawnScoreFloater(
            this.gameScene.player.x,
            this.gameScene.player.y - 20,
            message,
            '#ff2bd6'
          );
        }
      },
      onObstacleTriggered: () => {
        try {
          audioManager.playObstacleSpawn();
          if (this.gameScene) {
            this.gameScene.triggerObstacleSpawn();
            const newEnemy = this.gameScene.spawnAdditionalEnemy();
            if (newEnemy && this.gameScene.particleEffects && this.gameScene.player) {
              this.gameScene.particleEffects.spawnScoreFloater(
                this.gameScene.player.x,
                this.gameScene.player.y - 25,
                `⚠️ +1 ENEMY (${this.gameScene.enemies.length} TOTAL)`,
                '#ff0055'
              );
            }
          }
        } catch (err) {
          console.warn('Error handling obstacle/enemy spawn:', err);
        }
      },
      onShieldChanged: (hasShield) => {
        if (this.hud) this.hud.updateShield(hasShield);
        if (this.gameScene && this.gameScene.player) {
          this.gameScene.player.setShieldVisible(hasShield);
        }
      }
    });

    // Question Engine
    this.questionEngine = new QuestionEngine({
      onQuestionChanged: (data) => {
        if (this.questionPanel) {
          this.questionPanel.setQuestion(data);
        }
      },
      onTimerTick: (remaining, ratio) => {
        if (this.questionPanel) {
          this.questionPanel.updateTimer(remaining, ratio);
        }
      },
      onTimeout: () => {},
      onAnswerEvaluated: (result) => {
        this.handleAnswerResult(result);
      }
    });
  }

  // 3. Phaser 3 Game Instance
  initPhaser() {
    const config = {
      type: Phaser.AUTO,
      width: 672, // 21 cols * 32px
      height: 480, // 15 rows * 32px
      parent: 'phaser-container',
      backgroundColor: '#050611',
      physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }
      },
      scene: [GameScene]
    };

    this.phaserGame = new Phaser.Game(config);

    // Grab scene reference once ready
    this.phaserGame.events.once('ready', () => {
      this.gameScene = this.phaserGame.scene.getScene('GameScene');
      this.gameScene.setCallbacks({
        onFragmentCollected: (fragmentId) => {
          audioManager.playCollect();
          this.scoreManager.addFragmentScore(fragmentId, 25);
        },
        onPowerupCollected: (type) => {
          audioManager.playPowerup(type);
          if (type === 'shield') {
            this.scoreManager.grantShield();
          } else if (type === 'restore') {
            this.scoreManager.restoreHealth(20);
          } else if (type === 'overclock') {
            this.scoreManager.activateOverclock(8);
          }
        },
        onEnemyCollision: () => {
          if (!this.isGameActive || this.isPaused) return;
          try {
            audioManager.playDamage();
          } catch (_) {}

          let res = null;
          try {
            res = this.scoreManager.handleEnemyCollision();
          } catch (e) {
            console.error('Error handling enemy collision in scoreManager:', e);
          }

          try {
            if (this.gameScene && this.gameScene.particleEffects && this.gameScene.player) {
              this.gameScene.particleEffects.emitDamageGlitch(this.gameScene.player.x, this.gameScene.player.y);
            }
          } catch (_) {}

          if (res && (res.isDead || this.scoreManager.health <= 0)) {
            if (this.questionPanel) {
              this.questionPanel.cancelCountdown();
            }
            this.endGameRun(false);
          }
        },
        onObstacleSpawned: () => {
          // Obstacle activated in maze
        }
      });
    });
  }

  // 4. UI Layer Setup
  initUI() {
    // Player Registration Screen (Initial Flow Step)
    this.registrationUI = new Registration({
      onRegistered: (player) => {
        this.currentPlayer = player;
        if (this.hud) this.hud.setPlayer(player);
        if (this.mainMenu) {
          this.mainMenu.setPlayer(player);
          this.mainMenu.show();
        }
      },
      onNextPlayerRequested: () => {
        this.prepareNextPlayerSession();
      }
    });

    this.hud = new HUD({
      onPauseClicked: () => this.togglePause(),
      onMuteToggled: (muted) => {
        if (this.mainMenu) this.mainMenu.updateSoundIcon(muted);
      }
    });

    this.questionPanel = new QuestionPanel({
      onAnswerSelected: (selectedIndex) => {
        this.questionEngine.submitAnswer(selectedIndex);
      }
    });

    this.mainMenu = new MainMenu({
      onStartRequested: async () => {
        if (!this.currentPlayer) {
          this.prepareNextPlayerSession();
          return;
        }
        const eligibility = await storageManager.checkStudentEligibility(this.currentPlayer.enrollmentNumber);
        if (!eligibility.eligible) {
          audioManager.playWrong();
          if (this.registrationUI) {
            this.registrationUI.pendingStudent = this.currentPlayer;
            this.registrationUI.openRestrictedModal();
          }
          return;
        }
        this.startNewGameRun();
      },
      onLeaderboardRequested: () => {
        if (this.leaderboardUI) this.leaderboardUI.show();
      },
      onHelpRequested: () => {
        const modal = document.getElementById('modal-help');
        if (modal) modal.classList.remove('hidden');
      },
      onChangePlayer: () => {
        this.prepareNextPlayerSession();
      },
      onMuteToggled: (muted) => {
        if (this.hud) this.hud.updateMuteIcon(muted);
      }
    });

    this.gameOverUI = new GameOver({
      onNextPlayer: () => {
        this.prepareNextPlayerSession();
      },
      onPlayAgain: async () => {
        if (this.currentPlayer) {
          const eligibility = await storageManager.checkStudentEligibility(this.currentPlayer.enrollmentNumber);
          if (!eligibility.eligible) {
            audioManager.playWrong();
            if (this.registrationUI) {
              this.registrationUI.pendingStudent = this.currentPlayer;
              this.registrationUI.openRestrictedModal();
            }
            return;
          }
          this.startNewGameRun();
        } else {
          this.prepareNextPlayerSession();
        }
      },
      onViewLeaderboard: () => {
        if (this.leaderboardUI) this.leaderboardUI.show();
      },
      onReturnMenu: () => {
        const gameScreen = document.getElementById('screen-game');
        if (gameScreen) gameScreen.classList.add('hidden');
        if (this.mainMenu) this.mainMenu.show();
      }
    });

    this.leaderboardUI = new Leaderboard({
      onNextPlayer: () => {
        this.prepareNextPlayerSession();
      }
    });

    // How to Play modal close button
    const btnHelpClose = document.getElementById('btn-help-close');
    if (btnHelpClose) {
      btnHelpClose.addEventListener('click', () => {
        audioManager.playClick();
        const modal = document.getElementById('modal-help');
        if (modal) modal.classList.add('hidden');
      });
    }

    // Default entry: Registration is shown
    this.registrationUI.show();
  }

  // 5. Answer Evaluation Handler
  handleAnswerResult(result) {
    if (!this.isGameActive) return;

    if (this.questionPanel) {
      this.questionPanel.showFeedback(result);
    }

    const qId = result.question ? result.question.id : null;

    try {
      if (result.isCorrect) {
        this.scoreManager.awardCorrectAnswer(qId);
        if (this.gameScene && this.gameScene.player) {
          this.gameScene.player.triggerBoostEffect();
        }
      } else {
        audioManager.playWrong();
        // Apply 20% health reduction on mistake (wrong answer or timeout)
        if (result.isTimeout) {
          this.scoreManager.handleTimeoutWithDamage(qId);
        } else {
          this.scoreManager.handleMistake(false, qId, true);
        }

        if (this.gameScene && this.gameScene.particleEffects && this.gameScene.player) {
          this.gameScene.particleEffects.emitDamageGlitch(this.gameScene.player.x, this.gameScene.player.y);
        }
      }
    } catch (err) {
      console.warn('Error during score/health processing:', err);
    }

    if (this.hud) {
      try {
        this.hud.updateStreak(this.scoreManager.streak);
      } catch (_) {}
    }

    // If health reached 0, end game immediately
    if (this.scoreManager.health <= 0) {
      if (this.questionPanel) {
        this.questionPanel.cancelCountdown();
      }
      this.endGameRun(false);
      return;
    }

    // Trigger full-panel animated countdown (3 -> 2 -> 1) and advance to next question
    if (this.isGameActive && this.questionPanel) {
      this.questionPanel.startCountdown(result, () => {
        if (this.isGameActive && !this.isPaused && this.scoreManager.health > 0) {
          this.questionEngine.nextQuestion();
        }
      });
    } else if (this.isGameActive && !this.isPaused && this.scoreManager.health > 0) {
      this.questionEngine.nextQuestion();
    }
  }

  // 6. Master 120-Second Game Session
  startNewGameRun() {
    this.isGameActive = true;
    this.isPaused = false;
    this.sessionRemaining = this.sessionDuration;
    this.currentSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Show game screen, hide others
    const regScreen = document.getElementById('screen-registration');
    const menuScreen = document.getElementById('screen-menu');
    const gameScreen = document.getElementById('screen-game');
    const goScreen = document.getElementById('screen-gameover');
    if (regScreen) regScreen.classList.add('hidden');
    if (menuScreen) menuScreen.classList.add('hidden');
    if (goScreen) goScreen.classList.add('hidden');
    if (gameScreen) gameScreen.classList.remove('hidden');

    // Record attempt as actively started
    if (this.currentPlayer && this.currentPlayer.enrollmentNumber) {
      storageManager.recordAttemptStarted(this.currentPlayer.enrollmentNumber, this.currentPlayer.fullName);
    }

    // Reset systems
    this.scoreManager.reset();
    if (this.hud) {
      this.hud.updateTime(this.sessionRemaining);
      this.hud.updateScore(0);
      this.hud.updateStreak(0);
      this.hud.updateSpeed(1.0);
      this.hud.updateHealth(100);
      this.hud.setPlayer(this.currentPlayer);
    }

    // Start Phaser Run
    if (this.gameScene) {
      this.gameScene.setTimeRemaining(this.sessionRemaining, this.sessionDuration);
      this.gameScene.startRun();
    }

    // Start Question Engine
    this.questionEngine.start();

    // Start 120s Countdown Interval
    this.clearSessionTimer();
    this.sessionInterval = setInterval(() => {
      if (this.isPaused || !this.isGameActive) return;

      this.sessionRemaining -= 1;
      if (this.hud) {
        this.hud.updateTime(this.sessionRemaining);
      }
      if (this.gameScene) {
        this.gameScene.setTimeRemaining(this.sessionRemaining, this.sessionDuration);
      }

      // Progression: at 60s remaining, spawn 2nd enemy drone
      if (this.sessionRemaining === 60 && this.gameScene) {
        this.gameScene.addSecondEnemy();
      }

      if (this.sessionRemaining <= 0) {
        this.sessionRemaining = 0;
        this.clearSessionTimer();
        this.endGameRun(true); // Survived full 120s!
      }
    }, 1000);
  }

  clearSessionTimer() {
    if (this.sessionInterval) {
      clearInterval(this.sessionInterval);
      this.sessionInterval = null;
    }
  }

  endGameRun(isSurvived) {
    if (!this.isGameActive) return;
    this.isGameActive = false;
    this.clearSessionTimer();

    // Cancel any pending countdown transition immediately
    if (this.questionPanel) {
      this.questionPanel.cancelCountdown();
    }

    // Stop sub-systems
    this.questionEngine.stop();
    if (this.gameScene) {
      this.gameScene.stopRun();
    }

    // Calculate survival stats
    const survivalSecs = this.sessionDuration - this.sessionRemaining;
    const stats = this.scoreManager.getStatsSummary(survivalSecs);
    stats.isSurvived = isSurvived;

    // Show Game Over UI
    const gameScreen = document.getElementById('screen-game');
    if (gameScreen) gameScreen.classList.add('hidden');

    if (this.gameOverUI) {
      this.gameOverUI.show(stats, this.currentSessionId, this.currentPlayer);
    }
  }

  // 7. Reset and transition for Next Player
  prepareNextPlayerSession() {
    this.isGameActive = false;
    this.isPaused = false;
    this.clearSessionTimer();

    // Cancel countdown transition
    if (this.questionPanel) {
      this.questionPanel.cancelCountdown();
    }

    // Stop Question Engine and reset pool
    if (this.questionEngine) {
      this.questionEngine.stop();
      this.questionEngine.resetPool();
    }

    // Reset Score Manager
    if (this.scoreManager) {
      this.scoreManager.reset();
    }

    // Reset Phaser Scene completely
    if (this.gameScene) {
      this.gameScene.stopRun();
      if (this.gameScene.obstacleManager) {
        this.gameScene.obstacleManager.reset();
      }
      if (this.gameScene.maze) {
        this.gameScene.maze.reset();
      }
      if (this.gameScene.player) {
        this.gameScene.player.reset(1, 1);
      }
      this.gameScene.initEnemies();
      this.gameScene.initCollectibles();
    }

    // Reset HUD
    if (this.hud) {
      this.hud.updateTime(this.sessionDuration);
      this.hud.updateScore(0);
      this.hud.updateStreak(0);
      this.hud.updateSpeed(1.0);
      this.hud.updateHealth(100);
      this.hud.updateShield(false);
      this.hud.setPlayer(null);
    }

    // Clear active player credentials & session
    this.currentPlayer = null;
    this.currentSessionId = null;

    // Hide all other screens and modals
    const screens = ['screen-menu', 'screen-game', 'screen-gameover'];
    screens.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });

    const modals = ['modal-leaderboard', 'modal-help', 'modal-pause', 'modal-setup-guide'];
    modals.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });

    // Reset & Show Registration Form
    if (this.registrationUI) {
      this.registrationUI.reset();
      this.registrationUI.show();
    }
  }

  // 8. Pause System
  togglePause() {
    if (!this.isGameActive) return;
    this.isPaused = !this.isPaused;

    const modalPause = document.getElementById('modal-pause');

    if (this.isPaused) {
      if (modalPause) modalPause.classList.remove('hidden');
      if (this.questionPanel) this.questionPanel.pauseCountdown();
      this.questionEngine.pause();
      if (this.gameScene) this.gameScene.pauseRun();
    } else {
      if (modalPause) modalPause.classList.add('hidden');
      if (this.questionPanel) this.questionPanel.resumeCountdown();
      this.questionEngine.resume();
      if (this.gameScene) this.gameScene.resumeRun();
    }
  }

  bindPauseAndGlobalEvents() {
    // ESC or Space or P key toggles pause
    window.addEventListener('keydown', (e) => {
      if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && this.isGameActive) {
        this.togglePause();
      }
    });

    const btnResume = document.getElementById('btn-pause-resume');
    const btnRestart = document.getElementById('btn-pause-restart');
    const btnMenu = document.getElementById('btn-pause-menu');

    if (btnResume) {
      btnResume.addEventListener('click', () => {
        audioManager.playClick();
        this.togglePause();
      });
    }

    if (btnRestart) {
      btnRestart.addEventListener('click', () => {
        audioManager.playClick();
        const modalPause = document.getElementById('modal-pause');
        if (modalPause) modalPause.classList.add('hidden');
        this.startNewGameRun();
      });
    }

    if (btnMenu) {
      btnMenu.addEventListener('click', () => {
        audioManager.playClick();
        const modalPause = document.getElementById('modal-pause');
        if (modalPause) modalPause.classList.add('hidden');
        this.isGameActive = false;
        this.clearSessionTimer();
        this.questionEngine.stop();
        if (this.gameScene) this.gameScene.stopRun();

        const gameScreen = document.getElementById('screen-game');
        if (gameScreen) gameScreen.classList.add('hidden');
        if (this.mainMenu) this.mainMenu.show();
      });
    }
  }
}

// Bootstrap once DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  window.cyberchaseApp = new CyberchaseApp();
});
