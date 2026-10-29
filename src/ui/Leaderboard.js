import { audioManager } from '../systems/AudioManager.js';
import { storageManager } from '../systems/StorageManager.js';

export class Leaderboard {
  constructor(options = {}) {
    this.onNextPlayer = options.onNextPlayer || (() => {});

    this.modalEl = document.getElementById('modal-leaderboard');
    this.tableBodyEl = document.getElementById('leaderboard-tbody');
    this.sourceBadgeEl = document.getElementById('leaderboard-source-badge');
    this.btnClose = document.getElementById('btn-leaderboard-close');
    this.btnRefresh = document.getElementById('btn-leaderboard-refresh');
    this.btnSetupGuide = document.getElementById('btn-leaderboard-setup');
    this.btnNextPlayer = document.getElementById('btn-leaderboard-next-player');
    this.guideModalEl = document.getElementById('modal-setup-guide');
    this.btnGuideClose = document.getElementById('btn-guide-close');

    this.tabV2 = document.getElementById('tab-lb-v2');
    this.tabAll = document.getElementById('tab-lb-all');
    this.btnClearLocal = document.getElementById('btn-lb-clear-local');
    this.currentFilter = 'v2';

    // Database & Cloud Console Elements
    this.dbInputKey = document.getElementById('db-input-anon-key');
    this.btnDbSaveKey = document.getElementById('btn-db-save-key');
    this.btnDbCopySchema = document.getElementById('btn-db-copy-schema');
    this.dbFeedback = document.getElementById('db-conn-feedback');
    this.dbStatusBadge = document.getElementById('db-conn-status-badge');

    this.bindEvents();

    // Setup realtime listener for cross-laptop synchronization
    storageManager.subscribeToLeaderboard(() => {
      // If modal is visible, re-render immediately
      if (this.modalEl && !this.modalEl.classList.contains('hidden')) {
        this.loadLeaderboard();
      }
    });
  }

  bindEvents() {
    if (this.tabV2) {
      this.tabV2.addEventListener('click', () => {
        audioManager.playClick();
        this.currentFilter = 'v2';
        this.updateTabStyles();
        this.loadLeaderboard();
      });
    }

    if (this.tabAll) {
      this.tabAll.addEventListener('click', () => {
        audioManager.playClick();
        this.currentFilter = 'all';
        this.updateTabStyles();
        this.loadLeaderboard();
      });
    }

    if (this.btnClearLocal) {
      this.btnClearLocal.addEventListener('click', () => {
        audioManager.playClick();
        if (confirm('Reset local leaderboard test archive to standard V2 champion baseline?')) {
          storageManager.resetLocalLeaderboard();
          this.loadLeaderboard();
        }
      });
    }

    if (this.btnClose) {
      this.btnClose.addEventListener('click', () => {
        audioManager.playClick();
        this.hide();
      });
    }

    if (this.btnRefresh) {
      this.btnRefresh.addEventListener('click', () => {
        audioManager.playClick();
        this.loadLeaderboard();
      });
    }

    if (this.btnNextPlayer) {
      this.btnNextPlayer.addEventListener('click', () => {
        audioManager.playClick();
        this.hide();
        this.onNextPlayer();
      });
    }

    if (this.btnSetupGuide) {
      this.btnSetupGuide.addEventListener('click', () => {
        audioManager.playClick();
        this.openDatabaseConsole();
      });
    }

    if (this.btnGuideClose) {
      this.btnGuideClose.addEventListener('click', () => {
        audioManager.playClick();
        if (this.guideModalEl) this.guideModalEl.classList.add('hidden');
      });
    }

    if (this.btnDbSaveKey) {
      this.btnDbSaveKey.addEventListener('click', () => {
        audioManager.playClick();
        this.handleConnectDatabase();
      });
    }

    if (this.btnDbCopySchema) {
      this.btnDbCopySchema.addEventListener('click', () => {
        audioManager.playClick();
        this.handleCopySchema();
      });
    }
  }

  updateTabStyles() {
    if (this.tabV2 && this.tabAll) {
      if (this.currentFilter === 'v2') {
        this.tabV2.style.borderColor = 'var(--neon-cyan)';
        this.tabV2.style.background = 'rgba(0,245,255,0.15)';
        this.tabV2.style.opacity = '1';
        this.tabAll.style.borderColor = 'rgba(255,255,255,0.2)';
        this.tabAll.style.background = 'transparent';
        this.tabAll.style.opacity = '0.7';
      } else {
        this.tabAll.style.borderColor = 'var(--electric-purple)';
        this.tabAll.style.background = 'rgba(157,78,221,0.15)';
        this.tabAll.style.opacity = '1';
        this.tabV2.style.borderColor = 'rgba(255,255,255,0.2)';
        this.tabV2.style.background = 'transparent';
        this.tabV2.style.opacity = '0.7';
      }
    }
  }

  show() {
    if (this.modalEl) {
      this.modalEl.classList.remove('hidden');
      this.loadLeaderboard();
    }
  }

  hide() {
    if (this.modalEl) {
      this.modalEl.classList.add('hidden');
    }
  }

  async loadLeaderboard() {
    if (!this.tableBodyEl) return;
    this.tableBodyEl.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:1.5rem; color:var(--neon-cyan);">CONNECTING TO ARCHIVE...</td></tr>`;

    const { source, entries } = await storageManager.getLeaderboard(this.currentFilter);

    if (this.sourceBadgeEl) {
      if (source === 'cloud') {
        this.sourceBadgeEl.textContent = 'SHARED EVENT CLOUD (LIVE)';
        this.sourceBadgeEl.className = 'badge-source cloud';
      } else {
        this.sourceBadgeEl.textContent = 'LOCAL TERMINAL ARCHIVE';
        this.sourceBadgeEl.className = 'badge-source local';
      }
    }

    this.tableBodyEl.innerHTML = '';

    if (!entries || entries.length === 0) {
      this.tableBodyEl.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding:2.8rem 1rem; color:var(--text-secondary); font-family:var(--font-heading);">
            <div style="font-size:1.8rem; margin-bottom:0.5rem; opacity:0.85;">⚡</div>
            <div style="font-size:0.95rem; font-weight:700; color:var(--text-primary); letter-spacing:0.06em;">NO REAL OPERATOR RUNS YET</div>
            <div style="font-size:0.75rem; color:var(--neon-cyan); margin-top:0.35rem; font-family:var(--font-mono);">BE THE FIRST TO ENTER THE GRID AND CLIMB THE LEADERBOARD</div>
          </td>
        </tr>
      `;
      return;
    }

    entries.forEach((row) => {
      const tr = document.createElement('tr');

      let rankClass = '';
      let rankIcon = `#${row.rank}`;
      if (row.rank === 1) { rankClass = 'rank-gold'; rankIcon = '🥇 1'; }
      else if (row.rank === 2) { rankClass = 'rank-silver'; rankIcon = '🥈 2'; }
      else if (row.rank === 3) { rankClass = 'rank-bronze'; rankIcon = '🥉 3'; }

      const attemptBadge = (row.attempt && row.attempt > 1)
        ? ` <span style="font-size:0.68rem; color:var(--electric-purple); border:1px solid rgba(157,78,221,0.5); padding:1px 4px; border-radius:3px;">RUN #${row.attempt}</span>`
        : '';

      tr.innerHTML = `
        <td class="${rankClass}">${rankIcon}</td>
        <td style="font-weight:700; color:var(--text-primary);">${row.name}</td>
        <td style="font-family:var(--font-mono); color:var(--neon-magenta); font-size:0.8rem;">${row.enrollment || 'N/A'}${attemptBadge}</td>
        <td style="color:var(--neon-cyan); font-weight:700;">${row.score.toLocaleString()}</td>
        <td>${row.accuracy}%</td>
        <td>${row.streak}🔥</td>
        <td style="color:var(--text-secondary); font-size:0.75rem;">${row.date || 'Day 1'}</td>
      `;

      this.tableBodyEl.appendChild(tr);
    });
  }

  openDatabaseConsole() {
    if (this.guideModalEl) {
      this.guideModalEl.classList.remove('hidden');
    }

    // Populate current key
    if (this.dbInputKey) {
      this.dbInputKey.value = storageManager.supabaseAnonKey || '';
    }

    this.updateConsoleStatusBadge();
  }

  updateConsoleStatusBadge() {
    if (this.dbStatusBadge) {
      if (storageManager.isCloudConfigured) {
        this.dbStatusBadge.textContent = 'SHARED EVENT CLOUD (LIVE)';
        this.dbStatusBadge.className = 'badge-source cloud';
      } else {
        this.dbStatusBadge.textContent = 'LOCAL ARCHIVE (KEY MISSING)';
        this.dbStatusBadge.className = 'badge-source local';
      }
    }
  }

  async handleConnectDatabase() {
    const key = this.dbInputKey ? this.dbInputKey.value.trim() : '';
    if (!key) {
      if (this.dbFeedback) {
        this.dbFeedback.textContent = '⚠ Please enter your Supabase Anon Public Key.';
        this.dbFeedback.style.color = '#ff4365';
      }
      return;
    }

    if (this.btnDbSaveKey) {
      this.btnDbSaveKey.textContent = 'TESTING...';
      this.btnDbSaveKey.disabled = true;
    }
    if (this.dbFeedback) {
      this.dbFeedback.textContent = 'Pinging Supabase database...';
      this.dbFeedback.style.color = '#00f5ff';
    }

    storageManager.initCloudClient(storageManager.supabaseUrl, key);

    try {
      const testRes = await storageManager.testCloudConnection();

      if (testRes.connected) {
        // Save to localStorage for instant cross-reload persistence
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('cyberchase_supabase_anon_key', key);
        }

        // Auto-sync any local student scores to Supabase
        const syncRes = await storageManager.syncLocalScoresToCloud();

        audioManager.playCollect();
        if (this.dbFeedback) {
          const syncNote = syncRes && syncRes.synced > 0 ? ` Synced ${syncRes.synced} local score(s) to cloud.` : '';
          this.dbFeedback.textContent = `✓ ${testRes.message}${syncNote}`;
          this.dbFeedback.style.color = '#39ff88';
        }

        // Re-subscribe and refresh leaderboard
        storageManager.subscribeToLeaderboard(() => {
          if (this.modalEl && !this.modalEl.classList.contains('hidden')) {
            this.loadLeaderboard();
          }
        });

        this.updateConsoleStatusBadge();
        this.loadLeaderboard();
      } else {
        audioManager.playWrong();
        if (this.dbFeedback) {
          this.dbFeedback.textContent = `✗ Connection Failed: ${testRes.error}`;
          this.dbFeedback.style.color = '#ff4365';
        }
        this.updateConsoleStatusBadge();
      }
    } catch (err) {
      audioManager.playWrong();
      if (this.dbFeedback) {
        this.dbFeedback.textContent = `✗ Error: ${err.message || 'Connection failed'}`;
        this.dbFeedback.style.color = '#ff4365';
      }
    } finally {
      if (this.btnDbSaveKey) {
        this.btnDbSaveKey.textContent = '⚡ CONNECT';
        this.btnDbSaveKey.disabled = false;
      }
    }
  }

  async handleCopySchema() {
    try {
      const resp = await fetch('/supabase-schema.sql');
      const sql = resp.ok ? await resp.text() : '';
      if (sql && navigator.clipboard) {
        await navigator.clipboard.writeText(sql);
        if (this.dbFeedback) {
          this.dbFeedback.textContent = '✓ SQL Schema copied to clipboard! Paste it into Supabase SQL Editor.';
          this.dbFeedback.style.color = '#39ff88';
        }
        return;
      }
    } catch (_) {}

    if (this.dbFeedback) {
      this.dbFeedback.textContent = 'ℹ Schema file is located at supabase-schema.sql in the project root.';
      this.dbFeedback.style.color = '#00f5ff';
    }
  }
}
