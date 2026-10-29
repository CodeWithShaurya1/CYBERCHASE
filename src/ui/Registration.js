import { audioManager } from '../systems/AudioManager.js';
import { storageManager } from '../systems/StorageManager.js';

export class Registration {
  constructor(options = {}) {
    this.onRegistered = options.onRegistered || (() => {});
    this.onNextPlayerRequested = options.onNextPlayerRequested || (() => {});

    // Registration Form Elements
    this.screenEl = document.getElementById('screen-registration');
    this.formEl = document.getElementById('form-registration');
    this.inputName = document.getElementById('reg-input-name');
    this.inputEnrollment = document.getElementById('reg-input-enrollment');
    this.errorName = document.getElementById('reg-error-name');
    this.errorEnrollment = document.getElementById('reg-error-enrollment');
    this.errorGlobal = document.getElementById('reg-error-global');
    this.btnContinue = document.getElementById('reg-btn-continue');

    // Access Restricted Modal Elements (Returning Student)
    this.modalRestricted = document.getElementById('modal-access-restricted');
    this.btnRestrictedNewPlayer = document.getElementById('btn-restricted-new-player');
    this.btnRestrictedAdminKey = document.getElementById('btn-restricted-admin-key');
    this.btnRestrictedGoBack = document.getElementById('btn-restricted-go-back');

    // Admin Key Authorization Modal Elements
    this.modalAdminAuth = document.getElementById('modal-admin-auth');
    this.formAdminAuth = document.getElementById('form-admin-auth');
    this.targetEnrollmentBadge = document.getElementById('admin-target-enrollment');
    this.inputAdminKey = document.getElementById('admin-input-key');
    this.errorAdminKey = document.getElementById('admin-auth-error');
    this.statusAdminAuth = document.getElementById('admin-auth-status');
    this.btnAdminVerify = document.getElementById('btn-admin-verify');
    this.btnAdminCancel = document.getElementById('btn-admin-cancel');

    // Pending student state when blocked
    this.pendingStudent = null;
    this.isChecking = false;

    this.bindEvents();
  }

  bindEvents() {
    if (this.btnContinue) {
      this.btnContinue.addEventListener('mouseenter', () => audioManager.playHover());
    }

    if (this.formEl) {
      this.formEl.addEventListener('submit', (e) => {
        e.preventDefault();
        this.submit();
      });
    }

    // Auto clear errors and auto-uppercase input
    if (this.inputName) {
      this.inputName.addEventListener('input', () => {
        this.inputName.value = this.inputName.value.toUpperCase();
        this.clearError('name');
      });
    }

    if (this.inputEnrollment) {
      this.inputEnrollment.addEventListener('input', () => {
        this.inputEnrollment.value = this.inputEnrollment.value.toUpperCase();
        this.clearError('enrollment');
      });
    }

    // --- Access Restricted Modal Events ---
    if (this.btnRestrictedNewPlayer) {
      this.btnRestrictedNewPlayer.addEventListener('mouseenter', () => audioManager.playHover());
      this.btnRestrictedNewPlayer.addEventListener('click', () => {
        audioManager.playClick();
        this.closeRestrictedModal();
        if (this.onNextPlayerRequested) {
          this.onNextPlayerRequested();
        } else {
          this.reset();
          this.show();
        }
      });
    }

    if (this.btnRestrictedGoBack) {
      this.btnRestrictedGoBack.addEventListener('mouseenter', () => audioManager.playHover());
      this.btnRestrictedGoBack.addEventListener('click', () => {
        audioManager.playClick();
        this.closeRestrictedModal();
        if (this.onNextPlayerRequested) {
          this.onNextPlayerRequested();
        } else {
          this.reset();
          this.show();
        }
      });
    }

    if (this.btnRestrictedAdminKey) {
      this.btnRestrictedAdminKey.addEventListener('mouseenter', () => audioManager.playHover());
      this.btnRestrictedAdminKey.addEventListener('click', () => {
        audioManager.playClick();
        this.closeRestrictedModal();
        this.openAdminAuthModal();
      });
    }

    // --- Admin Authorization Modal Events ---
    if (this.btnAdminCancel) {
      this.btnAdminCancel.addEventListener('mouseenter', () => audioManager.playHover());
      this.btnAdminCancel.addEventListener('click', () => {
        audioManager.playClick();
        this.closeAdminAuthModal();
        this.openRestrictedModal();
      });
    }

    if (this.formAdminAuth) {
      this.formAdminAuth.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleAdminAuthSubmit();
      });
    }

    if (this.inputAdminKey) {
      this.inputAdminKey.addEventListener('input', () => {
        if (this.errorAdminKey) this.errorAdminKey.textContent = '';
      });
    }
  }

  show() {
    if (this.screenEl) {
      this.screenEl.classList.remove('hidden');
    }
    // Focus first input
    setTimeout(() => {
      if (this.inputName) this.inputName.focus();
    }, 150);
  }

  hide() {
    if (this.screenEl) {
      this.screenEl.classList.add('hidden');
    }
  }

  reset() {
    if (this.inputName) this.inputName.value = '';
    if (this.inputEnrollment) this.inputEnrollment.value = '';
    this.pendingStudent = null;
    this.clearAllErrors();
    this.closeRestrictedModal();
    this.closeAdminAuthModal();
  }

  clearError(field) {
    if (field === 'name') {
      if (this.inputName) this.inputName.classList.remove('input-error');
      if (this.errorName) this.errorName.textContent = '';
    }
    if (field === 'enrollment') {
      if (this.inputEnrollment) this.inputEnrollment.classList.remove('input-error');
      if (this.errorEnrollment) this.errorEnrollment.textContent = '';
    }
    if (this.errorGlobal) this.errorGlobal.textContent = '';
  }

  clearAllErrors() {
    if (this.inputName) this.inputName.classList.remove('input-error');
    if (this.inputEnrollment) this.inputEnrollment.classList.remove('input-error');
    if (this.errorName) this.errorName.textContent = '';
    if (this.errorEnrollment) this.errorEnrollment.textContent = '';
    if (this.errorGlobal) this.errorGlobal.textContent = '';
  }

  // --- Modal Controllers ---

  openRestrictedModal() {
    if (this.modalRestricted) {
      this.modalRestricted.classList.remove('hidden');
    }
    if (this.btnRestrictedAdminKey) {
      this.btnRestrictedAdminKey.focus();
    }
  }

  closeRestrictedModal() {
    if (this.modalRestricted) {
      this.modalRestricted.classList.add('hidden');
    }
  }

  openAdminAuthModal() {
    if (this.modalAdminAuth) {
      this.modalAdminAuth.classList.remove('hidden');
    }
    if (this.targetEnrollmentBadge && this.pendingStudent) {
      this.targetEnrollmentBadge.textContent = storageManager.normalizeEnrollment(this.pendingStudent.enrollmentNumber);
    }
    if (this.inputAdminKey) {
      this.inputAdminKey.value = '';
      this.inputAdminKey.focus();
    }
    if (this.errorAdminKey) {
      this.errorAdminKey.textContent = '';
    }
    if (this.statusAdminAuth) {
      this.statusAdminAuth.classList.add('hidden');
      this.statusAdminAuth.textContent = '';
    }
  }

  closeAdminAuthModal() {
    if (this.modalAdminAuth) {
      this.modalAdminAuth.classList.add('hidden');
    }
    if (this.inputAdminKey) {
      this.inputAdminKey.value = '';
    }
  }

  // Submit Registration Form with Cross-Laptop Eligibility Check
  async submit() {
    if (this.isChecking) return;

    const rawName = this.inputName ? this.inputName.value.trim().toUpperCase() : '';
    const rawEnrollment = this.inputEnrollment ? this.inputEnrollment.value.trim().toUpperCase() : '';

    let hasError = false;

    if (!rawName) {
      if (this.inputName) this.inputName.classList.add('input-error');
      if (this.errorName) this.errorName.textContent = '⚠ Full Name is required';
      hasError = true;
    } else {
      this.clearError('name');
    }

    if (!rawEnrollment) {
      if (this.inputEnrollment) this.inputEnrollment.classList.add('input-error');
      if (this.errorEnrollment) this.errorEnrollment.textContent = '⚠ Enrollment Number is required';
      hasError = true;
    } else {
      this.clearError('enrollment');
    }

    if (hasError) {
      audioManager.playWrong();
      if (this.errorGlobal) {
        this.errorGlobal.textContent = 'AUTHENTICATION FAILED: ALL FIELDS REQUIRED';
      }
      return;
    }

    // Set checking state and UI spinner text
    this.isChecking = true;
    const originalBtnText = this.btnContinue ? this.btnContinue.textContent : 'CONTINUE TO GAME ➔';
    if (this.btnContinue) {
      this.btnContinue.textContent = '⚡ VERIFYING ELIGIBILITY...';
      this.btnContinue.style.opacity = '0.7';
    }

    try {
      // Check database eligibility across all laptops
      const eligibility = await storageManager.checkStudentEligibility(rawEnrollment);

      if (!eligibility.eligible) {
        // STUDENT HAS ALREADY PLAYED! Block and show cyberpunk restricted modal
        audioManager.playWrong();
        this.pendingStudent = {
          fullName: rawName,
          enrollmentNumber: rawEnrollment
        };
        if (this.errorGlobal) {
          this.errorGlobal.textContent = 'You have already played. Please contact the admin.';
        }
        this.openRestrictedModal();
        return;
      }

      // Eligible student (first attempt or already authorized)
      audioManager.playBoot();
      this.hide();

      this.onRegistered({
        fullName: rawName,
        enrollmentNumber: rawEnrollment
      });
    } catch (err) {
      console.error('Error during student registration check:', err);
      // Double check local records
      const localCheck = storageManager.checkLocalEligibility(rawEnrollment);
      if (!localCheck.eligible) {
        audioManager.playWrong();
        this.pendingStudent = {
          fullName: rawName,
          enrollmentNumber: rawEnrollment
        };
        if (this.errorGlobal) {
          this.errorGlobal.textContent = 'You have already played. Please contact the admin.';
        }
        this.openRestrictedModal();
        return;
      }

      audioManager.playBoot();
      this.hide();
      this.onRegistered({
        fullName: rawName,
        enrollmentNumber: rawEnrollment
      });
    } finally {
      this.isChecking = false;
      if (this.btnContinue) {
        this.btnContinue.textContent = originalBtnText;
        this.btnContinue.style.opacity = '1';
      }
    }
  }

  // Handle Admin Key Verification
  async handleAdminAuthSubmit() {
    if (!this.pendingStudent) {
      this.closeAdminAuthModal();
      return;
    }

    const adminKey = this.inputAdminKey ? this.inputAdminKey.value.trim() : '';

    if (!adminKey) {
      audioManager.playWrong();
      if (this.errorAdminKey) {
        this.errorAdminKey.textContent = '⚠ Invalid admin key';
      }
      if (this.inputAdminKey) {
        this.inputAdminKey.classList.add('input-error');
        this.inputAdminKey.focus();
      }
      return;
    }

    // Show verifying status
    if (this.btnAdminVerify) {
      this.btnAdminVerify.textContent = 'VERIFYING...';
      this.btnAdminVerify.disabled = true;
    }
    if (this.errorAdminKey) {
      this.errorAdminKey.textContent = '';
    }

    try {
      const result = await storageManager.authorizeAttemptWithAdminKey(
        this.pendingStudent.enrollmentNumber,
        adminKey
      );

      if (result.success) {
        // Key Verified!
        audioManager.playCollect();
        if (this.statusAdminAuth) {
          this.statusAdminAuth.classList.remove('hidden');
          this.statusAdminAuth.textContent = '✓ AUTHORIZATION GRANTED! LAUNCHING RUN...';
        }

        setTimeout(() => {
          this.closeAdminAuthModal();
          this.hide();
          this.onRegistered({
            fullName: this.pendingStudent.fullName,
            enrollmentNumber: this.pendingStudent.enrollmentNumber,
            authorizedRepeat: true
          });
          this.pendingStudent = null;
        }, 800);
      } else {
        // Invalid key or Rate Limited
        audioManager.playWrong();
        if (this.errorAdminKey) {
          this.errorAdminKey.textContent = result.error || 'Invalid admin key';
        }
        if (this.inputAdminKey) {
          this.inputAdminKey.classList.add('input-error');
          this.inputAdminKey.select();
        }
      }
    } catch (err) {
      console.error('Error during admin key authorization:', err);
      audioManager.playWrong();
      if (this.errorAdminKey) {
        this.errorAdminKey.textContent = 'Invalid admin key';
      }
    } finally {
      if (this.btnAdminVerify) {
        this.btnAdminVerify.textContent = '⚡ VERIFY & UNLOCK';
        this.btnAdminVerify.disabled = false;
      }
    }
  }
}

