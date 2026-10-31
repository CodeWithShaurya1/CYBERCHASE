// Storage & Leaderboard Manager with Supabase Client + Local Fallback
import { createClient } from '@supabase/supabase-js';

const LOCAL_STORAGE_KEY = 'cyberchase_local_leaderboard_v2';
const SUBMITTED_SESSIONS_KEY = 'cyberchase_submitted_sessions';

// Production Mode: Zero Demo Data — Only Real User Runs Recorded
const DEFAULT_LEADERBOARD = [];

export const DEMO_ENROLLMENTS = new Set([
  '0101CS221001',
  '0101IT221045',
  '0101EC231012',
  '0101CS231089',
  '0101ME221034',
  '0101IT231067',
  '0101CS231023',
  '0101EE221056',
  '0101AI231015',
  '0101CS231099',
  'TEST12345',
  '0101TEST2026'
]);

export const DEMO_NAMES = new Set([
  'AARAV SHARMA',
  'PRIYA PATEL',
  'ROHAN VERMA',
  'ANANYA GUPTA',
  'VIKRAM SINGH',
  'SNEHA REDDY',
  'DEVANSH JOSHI',
  'KAVYA NAIR',
  'ARYAN MEHTA',
  'TANVI SAXENA',
  'TEST PLAYER'
]);

export const STARTER_MOCK_ENROLLMENTS = DEMO_ENROLLMENTS;

export function isDemoEntry(entry) {
  if (!entry) return false;
  if (entry.isStarterMock) return true;
  const normEnrollment = (entry.enrollment || entry.normalized_enrollment || '').trim().toUpperCase();
  const normName = (entry.name || '').trim().toUpperCase();
  if (DEMO_ENROLLMENTS.has(normEnrollment)) return true;
  if (DEMO_NAMES.has(normName)) return true;
  return false;
}

export class StorageManager {
  constructor() {
    this.supabaseUrl = (
      (typeof localStorage !== 'undefined' ? localStorage.getItem('cyberchase_supabase_url') : '') ||
      import.meta.env?.VITE_SUPABASE_URL ||
      'https://ursfmqitvpkupgasggaz.supabase.co'
    ).trim();

    this.supabaseAnonKey = (
      (typeof localStorage !== 'undefined' ? localStorage.getItem('cyberchase_supabase_anon_key') : '') ||
      import.meta.env?.VITE_SUPABASE_ANON_KEY ||
      'sb_publishable_53cvkUfK3Fb3V9ZJ8Qtjzw_s-Zd88ic'
    ).trim();

    this.supabase = null;
    this.realtimeChannel = null;
    this.isCloudConfigured = false;

    this.initCloudClient(this.supabaseUrl, this.supabaseAnonKey);

    this.submittedSessions = new Set(this.loadSubmittedSessions());
    this.memoryPlayedMap = {};
    this.memoryAuthSet = new Set();
    this.ensureLocalInitialData();

    // Auto-sync any pending local scores if cloud is operational
    if (this.isCloudConfigured) {
      setTimeout(() => {
        this.syncLocalScoresToCloud().catch(() => {});
      }, 500);
    }
  }

  // Initialize or re-initialize the Supabase client dynamically
  initCloudClient(url, key) {
    this.supabaseUrl = (url || '').trim();
    this.supabaseAnonKey = (key || '').trim();

    this.isCloudConfigured = Boolean(
      this.supabaseUrl &&
      this.supabaseAnonKey &&
      !this.supabaseAnonKey.includes('...') &&
      this.supabaseAnonKey.length > 20
    );

    if (this.isCloudConfigured) {
      try {
        this.supabase = createClient(this.supabaseUrl, this.supabaseAnonKey);
      } catch (err) {
        console.warn('Supabase client initialization error:', err);
        this.isCloudConfigured = false;
        this.supabase = null;
      }
    } else {
      this.supabase = null;
    }

    return this.isCloudConfigured;
  }

  // Live test Supabase database connectivity and schema readiness
  async testCloudConnection() {
    if (!this.isCloudConfigured || !this.supabase) {
      return {
        connected: false,
        error: 'Supabase Anon Key is missing or empty. Please enter your Anon Key.'
      };
    }

    const startTime = Date.now();
    try {
      const { data, error } = await this.supabase
        .from('cyberchase_leaderboard')
        .select('id')
        .limit(1);

      const latency = Date.now() - startTime;

      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          return {
            connected: true,
            tableReady: false,
            latency,
            message: 'Connected to Supabase, but the "cyberchase_leaderboard" table is not created yet. Please execute supabase-schema.sql in the Supabase SQL Editor.',
            error: error.message
          };
        }
        return {
          connected: false,
          error: error.message || 'Database error occurred'
        };
      }

      return {
        connected: true,
        tableReady: true,
        latency,
        message: `Successfully connected to Supabase (${latency}ms)! Live cross-laptop sync is operational.`
      };
    } catch (err) {
      return {
        connected: false,
        error: err.message || 'Connection failed'
      };
    }
  }

  ensureLocalInitialData() {
    try {
      if (typeof localStorage !== 'undefined') {
        const existing = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (existing) {
          try {
            const parsed = JSON.parse(existing);
            if (Array.isArray(parsed)) {
              // Strictly remove any demo records from local storage
              const realOnly = parsed.filter(r => !isDemoEntry(r));
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(realOnly));
            }
          } catch (_) { }
        } else {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([]));
        }
      }
    } catch (_) { }
  }

  loadSubmittedSessions() {
    try {
      if (typeof localStorage !== 'undefined') {
        const data = localStorage.getItem(SUBMITTED_SESSIONS_KEY);
        return data ? JSON.parse(data) : [];
      }
    } catch (_) { }
    return [];
  }

  markSessionSubmitted(sessionId) {
    if (!sessionId) return;
    this.submittedSessions.add(sessionId);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SUBMITTED_SESSIONS_KEY, JSON.stringify([...this.submittedSessions]));
      }
    } catch (_) { }
  }

  isSessionSubmitted(sessionId) {
    return this.submittedSessions.has(sessionId);
  }

  // All student names stored in ALL CAPITAL / UPPER CASE
  sanitizeName(name) {
    if (!name || typeof name !== 'string') return 'OPERATOR';
    const trimmed = name.trim().slice(0, 40).toUpperCase();
    return trimmed.length > 0 ? trimmed : 'OPERATOR';
  }

  // All student enrollments stored in ALL CAPITAL / UPPER CASE
  sanitizeEnrollment(enrollment) {
    if (!enrollment || typeof enrollment !== 'string') return 'N/A';
    const trimmed = enrollment.trim().slice(0, 40).toUpperCase();
    return trimmed.length > 0 ? trimmed : 'N/A';
  }

  normalizeEnrollment(enrollment) {
    if (!enrollment || typeof enrollment !== 'string') return '';
    return enrollment.trim().toUpperCase();
  }

  // Record an attempt started immediately upon registration so re-entering is blocked
  recordAttemptStarted(enrollment, name) {
    const normalized = this.normalizeEnrollment(enrollment);
    if (!normalized) return;

    this.memoryPlayedMap[normalized] = Math.max(1, (this.memoryPlayedMap[normalized] || 0) + 1);

    try {
      if (typeof localStorage !== 'undefined') {
        const playedData = localStorage.getItem('cyberchase_played_enrollments');
        const playedMap = playedData ? JSON.parse(playedData) : {};
        playedMap[normalized] = Math.max(1, (playedMap[normalized] || 0) + 1);
        localStorage.setItem('cyberchase_played_enrollments', JSON.stringify(playedMap));
      }
    } catch (_) { }
  }

  // Check if student has already played CYBERCHASE across stall laptops
  async checkStudentEligibility(enrollment) {
    const normalized = this.normalizeEnrollment(enrollment);
    if (!normalized) {
      return { eligible: false, reason: 'EMPTY_ENROLLMENT' };
    }

    // Demo / mock enrollments should never block students
    if (DEMO_ENROLLMENTS.has(normalized)) {
      return { eligible: true, attempts: 0, hasAuthorization: false, source: 'local' };
    }

    let cloudAttempts = 0;
    let cloudHasAuth = false;
    let cloudChecked = false;

    // 1. Check against shared Supabase database with 3.5s timeout protection
    if (this.isCloudConfigured && this.supabase) {
      try {
        const cloudPromise = (async () => {
          // Try calling the dedicated eligibility RPC
          const { data: rpcData, error: rpcError } = await this.supabase
            .rpc('check_student_eligibility', { p_enrollment: normalized });

          if (!rpcError && rpcData && typeof rpcData.eligible === 'boolean') {
            return {
              checked: true,
              attempts: rpcData.attempts || 0,
              hasAuth: Boolean(rpcData.hasAuthorization),
              explicitBlock: !rpcData.eligible
            };
          }

          // Direct table query fallback: check both enrollment and normalized_enrollment
          const { data: records, error: queryError } = await this.supabase
            .from('cyberchase_leaderboard')
            .select('id, enrollment')
            .or(`normalized_enrollment.eq.${normalized},enrollment.ilike.${normalized}`);

          if (!queryError && Array.isArray(records)) {
            // Strictly exclude any demo records
            const realRecords = records.filter(r => !isDemoEntry(r));
            const attempts = realRecords.length;
            // Always check if there is an unused authorization for this student in cloud
            let hasAuth = false;
            try {
              const { data: authRecords } = await this.supabase
                .from('cyberchase_authorizations')
                .select('id')
                .eq('normalized_enrollment', normalized)
                .is('used_at', null)
                .limit(1);

              if (Array.isArray(authRecords) && authRecords.length > 0) {
                hasAuth = true;
                this.saveLocalAuthorization(normalized);
              }
            } catch (_) {}

            if (attempts > 0) {
              return { checked: true, attempts, hasAuth, explicitBlock: !hasAuth };
            }
            return { checked: true, attempts: 0, hasAuth, explicitBlock: false };
          }
          return { checked: false, attempts: 0, hasAuth: false, explicitBlock: false };
        })();

        const timeoutPromise = new Promise((resolve) =>
          setTimeout(() => resolve({ checked: false, timeout: true }), 3500)
        );

        const cloudRes = await Promise.race([cloudPromise, timeoutPromise]);
        if (cloudRes && cloudRes.checked) {
          cloudChecked = true;
          cloudAttempts = cloudRes.attempts;
          cloudHasAuth = cloudRes.hasAuth;

          // Check if authorized locally in memory or storage first
          const localCheck = this.checkLocalEligibility(normalized);
          if (cloudHasAuth || localCheck.hasAuthorization) {
            return {
              eligible: true,
              attempts: Math.max(cloudAttempts, localCheck.attempts),
              hasAuthorization: true,
              source: cloudHasAuth ? 'cloud' : 'local'
            };
          }

          if (cloudRes.explicitBlock) {
            return {
              eligible: false,
              attempts: cloudAttempts,
              hasAuthorization: false,
              source: 'cloud'
            };
          }
        }
      } catch (err) {
        console.warn('Error querying Supabase for student eligibility:', err);
      }
    }

    // 2. Check Local Storage and Memory state
    const local = this.checkLocalEligibility(normalized);

    // If student has an authorization (from cloud or local admin key), allow
    if (cloudHasAuth || local.hasAuthorization) {
      return {
        eligible: true,
        attempts: Math.max(cloudAttempts, local.attempts),
        hasAuthorization: true,
        source: cloudChecked ? 'cloud' : 'local'
      };
    }

    // If either cloud OR local shows previous attempts, STRICTLY BLOCK!
    const totalAttempts = Math.max(cloudAttempts, local.attempts);
    if (totalAttempts > 0) {
      return {
        eligible: false,
        attempts: totalAttempts,
        hasAuthorization: false,
        source: cloudAttempts > 0 ? 'cloud' : 'local'
      };
    }

    return {
      eligible: true,
      attempts: 0,
      hasAuthorization: false,
      source: cloudChecked ? 'cloud' : 'local'
    };
  }

  checkLocalEligibility(normalizedEnrollment) {
    if (DEMO_ENROLLMENTS.has(normalizedEnrollment)) {
      return { eligible: true, attempts: 0, hasAuthorization: false, source: 'local' };
    }

    let attempts = this.memoryPlayedMap[normalizedEnrollment] || 0;
    let hasAuth = this.memoryAuthSet.has(normalizedEnrollment);

    try {
      if (typeof localStorage !== 'undefined') {
        // 1. Check played enrollments map
        const playedData = localStorage.getItem('cyberchase_played_enrollments');
        const playedMap = playedData ? JSON.parse(playedData) : {};
        if (typeof playedMap[normalizedEnrollment] === 'number') {
          attempts = Math.max(attempts, playedMap[normalizedEnrollment]);
        }

        // 2. Check local leaderboard entries for previous scores with this enrollment (ignoring demo entries)
        const lbData = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (lbData) {
          const lbList = JSON.parse(lbData);
          if (Array.isArray(lbList)) {
            const countInLb = lbList.filter(row =>
              row &&
              !isDemoEntry(row) &&
              this.normalizeEnrollment(row.enrollment) === normalizedEnrollment
            ).length;
            attempts = Math.max(attempts, countInLb);
          }
        }

        // 3. Check local authorizations
        const authData = localStorage.getItem('cyberchase_local_authorizations');
        const authList = authData ? JSON.parse(authData) : [];
        if (authList.includes(normalizedEnrollment)) {
          hasAuth = true;
        }
      }
    } catch (_) { }

    if (attempts === 0 || hasAuth) {
      return { eligible: true, attempts, hasAuthorization: hasAuth, source: 'local' };
    }

    return { eligible: false, attempts, hasAuthorization: false, source: 'local' };
  }

  // Authorize another attempt using the Admin Key (Edge Function or secure RPC)
  async authorizeAttemptWithAdminKey(enrollment, adminKey) {
    const normalized = this.normalizeEnrollment(enrollment);
    const trimmedKey = (adminKey || '').trim();

    if (!normalized) {
      return { success: false, error: 'Enrollment number is required' };
    }
    if (!trimmedKey) {
      return { success: false, error: 'Invalid admin key' };
    }

    // 1. Try Supabase Edge Function first
    if (this.isCloudConfigured && this.supabaseUrl) {
      try {
        const edgeFunctionUrl = `${this.supabaseUrl.replace(/\/$/, '')}/functions/v1/authorize-attempt`;
        const resp = await fetch(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': this.supabaseAnonKey,
            'Authorization': `Bearer ${this.supabaseAnonKey}`
          },
          body: JSON.stringify({ enrollment: normalized, adminKey: trimmedKey })
        });

        if (resp.status === 200) {
          const resData = await resp.json();
          if (resData.success) {
            this.saveLocalAuthorization(normalized);
            return { success: true, message: resData.message || 'Attempt authorized' };
          }
        } else if (resp.status === 401 || resp.status === 403) {
          const resData = await resp.json().catch(() => ({}));
          return { success: false, error: resData.error || 'Invalid admin key' };
        } else if (resp.status === 429) {
          const resData = await resp.json().catch(() => ({}));
          return { success: false, error: resData.error || 'Too many attempts. Please wait.' };
        }
        // If 404 or other status, try RPC fallback below
      } catch (e) {
        console.warn('Edge Function authorize-attempt unavailable, trying database RPC:', e);
      }

      // 2. Database RPC fallback (verify_admin_and_authorize)
      if (this.supabase) {
        try {
          const { data: rpcData, error: rpcError } = await this.supabase
            .rpc('verify_admin_and_authorize', {
              p_enrollment: normalized,
              p_admin_key: trimmedKey
            });

          if (!rpcError && rpcData) {
            if (rpcData.success) {
              this.saveLocalAuthorization(normalized);
              return { success: true, message: rpcData.message || 'Attempt authorized' };
            } else {
              return { success: false, error: rpcData.error || 'Invalid admin key' };
            }
          }
        } catch (rpcErr) {
          console.warn('Admin authorization RPC failed:', rpcErr);
        }
      }
    }

    // SHA-256 hash of admin key (one-way hash, never exposing plain key in JS)
    const EXPECTED_HASH = 'fec670eaa6b7732ddd1fab99a102d1413c7c439fcd8f3fdc2310d458ad2036bc';
    try {
      if (typeof crypto !== 'undefined' && crypto.subtle) {
        const msgUint8 = new TextEncoder().encode(trimmedKey);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        if (hashHex === EXPECTED_HASH) {
          // Store local authorization in memory and localStorage
          this.saveLocalAuthorization(normalized);
          return { success: true, message: 'Local attempt authorized' };
        }
      }
    } catch (_) { }

    return { success: false, error: 'Invalid admin key' };
  }

  // Save student authorization locally in memory and localStorage
  saveLocalAuthorization(normalized) {
    if (!normalized) return;
    this.memoryAuthSet.add(normalized);
    try {
      if (typeof localStorage !== 'undefined') {
        const authData = localStorage.getItem('cyberchase_local_authorizations');
        const authList = authData ? JSON.parse(authData) : [];
        if (!authList.includes(normalized)) {
          authList.push(normalized);
          localStorage.setItem('cyberchase_local_authorizations', JSON.stringify(authList));
        }
      }
    } catch (_) {}
  }

  // Sync any non-mock local scores to the cloud database
  async syncLocalScoresToCloud() {
    if (!this.isCloudConfigured || !this.supabase) return { synced: 0 };

    try {
      if (typeof localStorage === 'undefined') return { synced: 0 };
      const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!localData) return { synced: 0 };

      const localList = JSON.parse(localData);
      if (!Array.isArray(localList)) return { synced: 0 };

      // Filter only real student player scores (excluding starter mocks)
      const realScores = localList.filter(row =>
        row &&
        !row.isStarterMock &&
        !STARTER_MOCK_ENROLLMENTS.has(this.normalizeEnrollment(row.enrollment))
      );

      if (realScores.length === 0) return { synced: 0 };

      // Query existing enrollments in cloud to avoid duplicate insertions
      const { data: existingRows } = await this.supabase
        .from('cyberchase_leaderboard')
        .select('normalized_enrollment, enrollment, score');

      const existingSet = new Set(
        (existingRows || []).map(r => `${this.normalizeEnrollment(r.enrollment || r.normalized_enrollment)}_${r.score}`)
      );

      let syncedCount = 0;
      for (const item of realScores) {
        const norm = this.normalizeEnrollment(item.enrollment);
        const key = `${norm}_${item.score}`;
        if (!existingSet.has(key)) {
          const insertPayload = {
            name: this.sanitizeName(item.name),
            enrollment: this.sanitizeEnrollment(item.enrollment),
            normalized_enrollment: norm,
            score: Math.max(0, Math.floor(item.score || 0)),
            accuracy: Math.max(0, Math.min(100, Math.floor(item.accuracy || 0))),
            correct_answers: Math.max(0, Math.floor(item.correct_answers || 0)),
            wrong_answers: Math.max(0, Math.floor(item.wrong_answers || 0)),
            streak: Math.max(0, Math.floor(item.streak || 0)),
            fragments: Math.max(0, Math.floor(item.fragments || 0)),
            scoring_version: item.scoring_version || 'v2'
          };

          const { error: insErr } = await this.supabase
            .from('cyberchase_leaderboard')
            .insert([insertPayload]);

          if (!insErr) {
            syncedCount++;
            existingSet.add(key);
          }
        }
      }

      return { synced: syncedCount };
    } catch (e) {
      console.warn('Local-to-cloud sync warning:', e);
      return { synced: 0, error: e.message };
    }
  }

  // Fetch top 10 leaderboard entries sorted by: highest score, accuracy desc, created_at asc
  async getLeaderboard(filterVersion = 'v2') {
    // Try cloud first if configured
    if (this.isCloudConfigured && this.supabase) {
      try {
        let query = this.supabase
          .from('cyberchase_leaderboard')
          .select('name, enrollment, score, accuracy, correct_answers, wrong_answers, streak, fragments, created_at, attempt_number, scoring_version');

        if (filterVersion === 'v2') {
          query = query.eq('scoring_version', 'v2');
        }

        // Exclude all demo enrollments at database level
        const demoList = Array.from(DEMO_ENROLLMENTS).join(',');
        query = query.not('enrollment', 'in', `(${demoList})`);

        const { data, error } = await query
          .order('score', { ascending: false })
          .order('accuracy', { ascending: false })
          .order('created_at', { ascending: true })
          .limit(10);

        if (!error && Array.isArray(data)) {
          // Additional safeguard to filter out any demo or starter mock entries
          const realCloudData = data.filter(row => !isDemoEntry(row));

          const cloudEntries = realCloudData.map((row, idx) => ({
            rank: idx + 1,
            name: row.name,
            enrollment: row.enrollment || 'N/A',
            score: row.score,
            accuracy: row.accuracy,
            correct_answers: row.correct_answers || 0,
            wrong_answers: row.wrong_answers || 0,
            streak: row.streak || 0,
            fragments: row.fragments || 0,
            attempt: row.attempt_number || 1,
            scoring_version: row.scoring_version || 'v2',
            date: row.created_at ? new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live',
            source: 'cloud'
          }));

          return {
            source: 'cloud',
            entries: cloudEntries
          };
        }
      } catch (err) {
        console.warn('Cloud leaderboard fetch error, falling back to local storage:', err);
      }
    }

    // Local fallback
    return {
      source: 'local',
      entries: this.getLocalLeaderboard(filterVersion)
    };
  }

  getLocalLeaderboard(filterVersion = 'v2') {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        let list = stored ? JSON.parse(stored) : [];

        // Strictly filter out any demo data
        list = list.filter(r => !isDemoEntry(r));

        if (filterVersion === 'all') {
          const legacy = localStorage.getItem('cyberchase_legacy_leaderboard_v1');
          if (legacy) {
            try {
              const legacyList = JSON.parse(legacy);
              if (Array.isArray(legacyList)) {
                list = [...list, ...legacyList.filter(r => !isDemoEntry(r))];
              }
            } catch (_) { }
          }
        } else if (filterVersion === 'v2') {
          list = list.filter(r => r.scoring_version === 'v2' || r.score <= 3500);
        }

        list.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
          return 0;
        });
        return list.slice(0, 10).map((item, idx) => ({ ...item, rank: idx + 1, source: 'local' }));
      }
    } catch (_) { }
    return [];
  }

  // Submit score with Full Name, Enrollment Number, and telemetry
  async submitScore(entry, sessionId) {
    if (this.isSessionSubmitted(sessionId)) {
      return { success: false, reason: 'ALREADY_SUBMITTED' };
    }

    const sanitizedName = this.sanitizeName(entry.name);
    const sanitizedEnrollment = this.sanitizeEnrollment(entry.enrollment);
    const normalized = this.normalizeEnrollment(sanitizedEnrollment);

    const scoreItem = {
      name: sanitizedName,
      enrollment: sanitizedEnrollment,
      normalized_enrollment: normalized,
      score: Math.max(0, Math.floor(entry.score || 0)),
      accuracy: Math.max(0, Math.min(100, Math.floor(entry.accuracy || 0))),
      correct_answers: Math.max(0, Math.floor(entry.correct_answers ?? entry.correctCount ?? 0)),
      wrong_answers: Math.max(0, Math.floor(entry.wrong_answers ?? entry.wrongCount ?? 0)),
      streak: Math.max(0, Math.floor(entry.streak || 0)),
      fragments: Math.max(0, Math.floor(entry.fragments || 0)),
      scoring_version: 'v2',
      created_at: new Date().toISOString()
    };

    let cloudSuccess = false;
    let cloudBlockedReason = null;

    // Cloud upload using Supabase JS client
    if (this.isCloudConfigured && this.supabase) {
      try {
        let { error } = await this.supabase
          .from('cyberchase_leaderboard')
          .insert([scoreItem]);

        // If table doesn't have optional new columns, retry gracefully
        if (error && error.message) {
          const fallbackItem = { ...scoreItem };
          let shouldRetry = false;
          if (error.message.includes('scoring_version')) {
            delete fallbackItem.scoring_version;
            shouldRetry = true;
          }
          if (error.message.includes('normalized_enrollment')) {
            delete fallbackItem.normalized_enrollment;
            shouldRetry = true;
          }
          if (shouldRetry) {
            const retryRes = await this.supabase
              .from('cyberchase_leaderboard')
              .insert([fallbackItem]);
            error = retryRes.error;
          }
        }

        if (!error) {
          cloudSuccess = true;
        } else {
          console.warn('Supabase insert result:', error);
          if (error.message && error.message.includes('STUDENT_ALREADY_PLAYED')) {
            cloudBlockedReason = 'STUDENT_ALREADY_PLAYED';
          }
        }
      } catch (e) {
        console.warn('Cloud submission failed, storing locally:', e);
      }
    }

    if (cloudBlockedReason === 'STUDENT_ALREADY_PLAYED') {
      return {
        success: false,
        reason: 'STUDENT_ALREADY_PLAYED',
        message: 'You have already played CYBERCHASE! Duplicate submission rejected.'
      };
    }

    // Always record played count in memory and local storage
    this.memoryPlayedMap[normalized] = (this.memoryPlayedMap[normalized] || 0) + 1;
    this.memoryAuthSet.delete(normalized);

    try {
      if (typeof localStorage !== 'undefined') {
        // Record enrollment attempt
        const playedData = localStorage.getItem('cyberchase_played_enrollments');
        const playedMap = playedData ? JSON.parse(playedData) : {};
        playedMap[normalized] = (playedMap[normalized] || 0) + 1;
        localStorage.setItem('cyberchase_played_enrollments', JSON.stringify(playedMap));

        // Consume any local authorization
        const authData = localStorage.getItem('cyberchase_local_authorizations');
        if (authData) {
          const authList = JSON.parse(authData).filter(item => item !== normalized);
          localStorage.setItem('cyberchase_local_authorizations', JSON.stringify(authList));
        }
      }
    } catch (_) { }

    const local = this.getLocalLeaderboard('v2');
    local.push({ ...scoreItem, rank: 99, source: 'local', date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
    local.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      return 0;
    });

    // 1. Calculate exact local rank from full sorted list BEFORE slicing
    const exactLocalRank = local.findIndex(
      it => it.name === sanitizedName && it.enrollment === sanitizedEnrollment && it.score === scoreItem.score
    ) + 1;

    const updated = local.slice(0, 20).map((it, idx) => ({ ...it, rank: idx + 1 }));

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
      }
    } catch (_) { }

    this.markSessionSubmitted(sessionId);

    // 2. Calculate exact cloud rank if Supabase connected
    let cloudRank = null;
    if (cloudSuccess && this.supabase) {
      try {
        const { count: higherScores, error: err1 } = await this.supabase
          .from('cyberchase_leaderboard')
          .select('id', { count: 'exact', head: true })
          .gt('score', scoreItem.score);

        if (!err1 && typeof higherScores === 'number') {
          const { count: tieBreakers, error: err2 } = await this.supabase
            .from('cyberchase_leaderboard')
            .select('id', { count: 'exact', head: true })
            .eq('score', scoreItem.score)
            .gt('accuracy', scoreItem.accuracy);

          const ties = (!err2 && typeof tieBreakers === 'number') ? tieBreakers : 0;
          cloudRank = higherScores + ties + 1;
        }
      } catch (err) {
        console.warn('Could not compute exact cloud rank:', err);
      }
    }

    const calculatedRank = (cloudSuccess && cloudRank) ? cloudRank : (exactLocalRank > 0 ? exactLocalRank : 1);

    return {
      success: true,
      cloudSuccess,
      source: cloudSuccess ? 'cloud' : 'local',
      rank: calculatedRank,
      sanitizedName,
      sanitizedEnrollment
    };
  }

  // Subscribe to real-time changes on the shared leaderboard table
  subscribeToLeaderboard(onUpdate) {
    if (!this.isCloudConfigured || !this.supabase) return false;

    try {
      if (this.realtimeChannel) {
        this.realtimeChannel.unsubscribe();
      }

      this.realtimeChannel = this.supabase
        .channel('cyberchase-live-sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'cyberchase_leaderboard' },
          (payload) => {
            if (onUpdate) onUpdate(payload);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✓ Supabase Realtime connected for live leaderboard sync.');
          }
        });

      return true;
    } catch (err) {
      console.warn('Failed to subscribe to Supabase Realtime channel:', err);
      return false;
    }
  }

  unsubscribeFromLeaderboard() {
    if (this.realtimeChannel) {
      try {
        this.realtimeChannel.unsubscribe();
      } catch (_) { }
      this.realtimeChannel = null;
    }
  }

  // Clear local test scores if needed by organizer
  resetLocalLeaderboard() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_LEADERBOARD));
        localStorage.removeItem('cyberchase_played_enrollments');
        localStorage.removeItem('cyberchase_local_authorizations');
        localStorage.removeItem(SUBMITTED_SESSIONS_KEY);
      }
    } catch (_) { }
    this.memoryPlayedMap = {};
    this.memoryAuthSet.clear();
    this.submittedSessions.clear();
    return DEFAULT_LEADERBOARD;
  }

  // Reset tournament leaderboard via RPC if admin key provided
  async resetTournamentLeaderboard(adminKey) {
    if (this.isCloudConfigured && this.supabase) {
      try {
        const { data, error } = await this.supabase.rpc('reset_tournament_leaderboard', {
          p_admin_key: (adminKey || '').trim()
        });
        if (!error && data && data.success) {
          this.resetLocalLeaderboard();
          return { success: true, message: data.message, deleted: data.deleted_records };
        }
        if (error) {
          return { success: false, error: error.message };
        }
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    this.resetLocalLeaderboard();
    return { success: true, message: 'Local storage reset' };
  }
}

export const storageManager = new StorageManager();
