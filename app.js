/* ==========================================================================
   Antigravity Auth - Main Application & Event Listeners
   ========================================================================== */

class App {
  constructor() {
    this.init();
  }

  init() {
    document.addEventListener('DOMContentLoaded', () => {
      this.bindEvents();
      this.checkSession();
      window.ui.setupOTPInputs('2fa-otp-container');
      window.ui.setupOTPInputs('reset-otp-container');
    });
  }

  // Check active session on startup
  checkSession() {
    const session = window.db.getCurrentSession();
    if (session) {
      const user = window.db.findUserById(session.userId);
      if (user) {
        window.ui.renderDashboard(user);
        window.ui.showView('dashboard-view');
        return;
      }
    }
    window.ui.showView('login-view');
  }

  bindEvents() {
    // --- LOGIN FORM ---
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const identifier = document.getElementById('login-identifier').value;
        const password = document.getElementById('login-password').value;
        const rememberMe = document.getElementById('login-remember').checked;
        const btn = loginForm.querySelector('.btn-primary');

        try {
          this.setButtonLoading(btn, true);
          const result = await window.auth.login(identifier, password, rememberMe);
          
          if (result.requires2FA) {
            window.ui.showToast('ยืนยัน 2FA', `กรุณากรอกรหัส OTP (รหัสจำลองสำหรับทดสอบคือ: ${result.simulatedOTP})`, 'warning', 7000);
            document.getElementById('2fa-simulated-code').textContent = result.simulatedOTP;
            window.ui.showView('2fa-view');
          } else {
            window.ui.showToast('เข้าสู่ระบบสำเร็จ', `ยินดีต้อนรับกลับคุณ ${result.user.fullName}`, 'success');
            window.ui.renderDashboard(result.user);
            window.ui.showView('dashboard-view');
          }
        } catch (err) {
          window.ui.showToast('เข้าสู่ระบบไม่สำเร็จ', err.message, 'error');
        } finally {
          this.setButtonLoading(btn, false);
        }
      });
    }

    // --- REGISTER FORM ---
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
      const passwordInput = document.getElementById('register-password');
      passwordInput.addEventListener('input', () => {
        window.ui.updateStrengthMeter(passwordInput, 'register-strength-meter');
      });

      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = document.getElementById('register-fullname').value;
        const username = document.getElementById('register-username').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;
        const terms = document.getElementById('register-terms').checked;
        const btn = registerForm.querySelector('.btn-primary');

        if (!terms) {
          window.ui.showToast('แจ้งเตือน', 'กรุณายอมรับข้อกำหนดและเงื่อนไขการใช้งาน', 'warning');
          return;
        }

        if (password !== confirmPassword) {
          window.ui.showToast('ข้อผิดพลาด', 'รหัสผ่านทั้งสองช่องไม่ตรงกัน', 'error');
          return;
        }

        try {
          this.setButtonLoading(btn, true);
          const result = await window.auth.register(username, email, password, fullName);
          window.ui.showToast('ลงทะเบียนสำเร็จ', 'สร้างบัญชีผู้ใช้ใหม่เรียบร้อยแล้ว เข้าสู่ระบบโดยอัตโนมัติ', 'success');
          window.ui.renderDashboard(result.user);
          window.ui.showView('dashboard-view');
        } catch (err) {
          window.ui.showToast('ลงทะเบียนไม่สำเร็จ', err.message, 'error');
        } finally {
          this.setButtonLoading(btn, false);
        }
      });
    }

    // --- 2FA OTP FORM ---
    const form2FA = document.getElementById('2fa-form');
    if (form2FA) {
      form2FA.addEventListener('submit', async (e) => {
        e.preventDefault();
        const otpCode = window.ui.getOTPValue('2fa-otp-container');
        const btn = form2FA.querySelector('.btn-primary');

        try {
          this.setButtonLoading(btn, true);
          const result = await window.auth.verify2FA(otpCode);
          window.ui.showToast('ยืนยันตัวตนสำเร็จ', 'เข้าสู่ระบบเรียบร้อยแล้ว', 'success');
          window.ui.clearOTPInputs('2fa-otp-container');
          window.ui.renderDashboard(result.user);
          window.ui.showView('dashboard-view');
        } catch (err) {
          window.ui.showToast('การยืนยัน 2FA ล้มเหลว', err.message, 'error');
        } finally {
          this.setButtonLoading(btn, false);
        }
      });
    }

    // --- FORGOT PASSWORD FORM ---
    const forgotForm = document.getElementById('forgot-form');
    if (forgotForm) {
      forgotForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('forgot-email').value;
        const btn = forgotForm.querySelector('.btn-primary');

        try {
          this.setButtonLoading(btn, true);
          const result = await window.auth.requestPasswordReset(email);
          window.ui.showToast('ส่ง OTP เรียบร้อย', `รหัส OTP กู้คืนรหัสผ่านจำลองคือ: ${result.simulatedOTP}`, 'info', 8000);
          document.getElementById('reset-email-display').textContent = result.email;
          document.getElementById('reset-simulated-code').textContent = result.simulatedOTP;
          window.ui.showView('reset-password-view');
        } catch (err) {
          window.ui.showToast('เกิดข้อผิดพลาด', err.message, 'error');
        } finally {
          this.setButtonLoading(btn, false);
        }
      });
    }

    // --- RESET PASSWORD FORM ---
    const resetForm = document.getElementById('reset-form');
    if (resetForm) {
      const newPasswordInput = document.getElementById('reset-new-password');
      newPasswordInput.addEventListener('input', () => {
        window.ui.updateStrengthMeter(newPasswordInput, 'reset-strength-meter');
      });

      resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('reset-email-display').textContent;
        const otpCode = window.ui.getOTPValue('reset-otp-container');
        const newPassword = document.getElementById('reset-new-password').value;
        const btn = resetForm.querySelector('.btn-primary');

        try {
          this.setButtonLoading(btn, true);
          await window.auth.confirmPasswordReset(email, otpCode, newPassword);
          window.ui.showToast('ตั้งรหัสผ่านใหม่สำเร็จ', 'รหัสผ่านของคุณได้รับการอัปเดตแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่', 'success');
          window.ui.clearOTPInputs('reset-otp-container');
          window.ui.showView('login-view');
        } catch (err) {
          window.ui.showToast('รีเซ็ตรหัสผ่านล้มเหลว', err.message, 'error');
        } finally {
          this.setButtonLoading(btn, false);
        }
      });
    }

    // --- PASSWORD VISIBILITY TOGGLE ---
    document.querySelectorAll('.toggle-password').forEach(button => {
      button.addEventListener('click', () => {
        const input = button.parentElement.querySelector('input');
        const icon = button.querySelector('i');
        if (input.type === 'password') {
          input.type = 'text';
          icon.classList.replace('fa-eye', 'fa-eye-slash');
        } else {
          input.type = 'password';
          icon.classList.replace('fa-eye-slash', 'fa-eye');
        }
      });
    });

    // --- DASHBOARD NAVIGATION TABS ---
    document.querySelectorAll('.nav-item-btn[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        document.querySelectorAll('.nav-item-btn[data-tab]').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.dashboard-tab-pane').forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const pane = document.getElementById(`tab-${targetTab}`);
        if (pane) pane.classList.add('active');

        if (targetTab === 'snake-game' && typeof window.initSnakeGame === 'function') {
          setTimeout(() => {
            window.initSnakeGame();
          }, 50);
        }
      });
    });

    // --- PROFILE UPDATE ---
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
      profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const session = window.db.getCurrentSession();
        if (!session) return;

        const fullName = document.getElementById('profile-fullname-input').value;
        const avatar = document.getElementById('profile-avatar-preview').src;
        const btn = profileForm.querySelector('.btn-primary');

        try {
          this.setButtonLoading(btn, true);
          const updatedUser = await window.auth.updateProfile(session.userId, fullName, avatar);
          window.ui.showToast('อัปเดตโปรไฟล์สำเร็จ', 'บันทึกข้อมูลส่วนตัวใหม่แล้ว', 'success');
          window.ui.renderDashboard(updatedUser);
        } catch (err) {
          window.ui.showToast('อัปเดตล้มเหลว', err.message, 'error');
        } finally {
          this.setButtonLoading(btn, false);
        }
      });
    }

    // --- CHANGE PASSWORD FORM ---
    const changePassForm = document.getElementById('change-password-form');
    if (changePassForm) {
      changePassForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const session = window.db.getCurrentSession();
        if (!session) return;

        const currentPass = document.getElementById('change-current-pass').value;
        const newPass = document.getElementById('change-new-pass').value;
        const btn = changePassForm.querySelector('.btn-primary');

        try {
          this.setButtonLoading(btn, true);
          await window.auth.changePassword(session.userId, currentPass, newPass);
          window.ui.showToast('เปลี่ยนรหัสผ่านสำเร็จ', 'รหัสผ่านของคุณถูกเปลี่ยนเรียบร้อยแล้ว', 'success');
          changePassForm.reset();
        } catch (err) {
          window.ui.showToast('เปลี่ยนรหัสผ่านล้มเหลว', err.message, 'error');
        } finally {
          this.setButtonLoading(btn, false);
        }
      });
    }

    // --- 2FA TOGGLE SWITCH ---
    const twoFactorToggle = document.getElementById('setting-2fa-toggle');
    if (twoFactorToggle) {
      twoFactorToggle.addEventListener('change', async () => {
        const session = window.db.getCurrentSession();
        if (!session) return;

        const enabled = twoFactorToggle.checked;
        try {
          const updatedUser = await window.auth.toggleTwoFactor(session.userId, enabled);
          window.ui.showToast('อัปเดต 2FA', enabled ? 'เปิดใช้งาน 2FA เรียบร้อยแล้ว' : 'ปิดใช้งาน 2FA แล้ว', 'info');
          window.ui.renderDashboard(updatedUser);
        } catch (err) {
          window.ui.showToast('ข้อผิดพลาด', err.message, 'error');
          twoFactorToggle.checked = !enabled;
        }
      });
    }

    // --- LOGOUT BUTTONS ---
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        window.auth.logout();
        window.ui.showToast('ออกจากระบบ', 'ออกจากระบบเรียบร้อยแล้ว', 'info');
        window.ui.showView('login-view');
      });
    }

    const logoutAllBtn = document.getElementById('btn-logout-all');
    if (logoutAllBtn) {
      logoutAllBtn.addEventListener('click', () => {
        const session = window.db.getCurrentSession();
        if (session) {
          window.auth.logoutAllDevices(session.userId);
          window.ui.renderActiveSessions(session.userId);
          window.ui.showToast('ความปลอดภัย', 'ยุติเซสชันบนอุปกรณ์อื่นทั้งหมดเรียบร้อยแล้ว', 'success');
        }
      });
    }
  }

  // Social Login Simulation
  handleSocialLogin(provider) {
    window.ui.showToast(`เข้าสู่ระบบด้วย ${provider}`, `กำลังเข้าสู่ระบบด้วยบัญชี ${provider} (Demo Session)...`, 'info');
    setTimeout(async () => {
      try {
        const mockEmail = provider === 'Google' ? 'demo.google@antigravity.dev' : 'demo.github@antigravity.dev';
        let user = window.db.findUserByEmail(mockEmail);
        
        if (!user) {
          const salt = window.security.generateSalt(16);
          const passwordHash = await window.security.hashPassword('SocialPassword123!', salt);
          user = {
            id: 'usr_' + provider.toLowerCase() + '_' + Date.now(),
            username: `${provider.toLowerCase()}_user`,
            email: mockEmail,
            fullName: `${provider} Demo User`,
            passwordHash,
            salt,
            role: 'user',
            isTwoFactorEnabled: false,
            twoFactorSecret: 'KVKXS2CVOR4X2ZCY',
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${provider}`,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString()
          };
          window.db.saveUser(user);
        }

        const result = window.auth.completeLogin(user, true);
        window.ui.showToast('เข้าสู่ระบบสำเร็จ', `เข้าสู่ระบบผ่าน ${provider} เรียบร้อยแล้ว`, 'success');
        window.ui.renderDashboard(result.user);
        window.ui.showView('dashboard-view');
      } catch (err) {
        window.ui.showToast(' Social Login ล้มเหลว', err.message, 'error');
      }
    }, 1000);
  }

  // Select Avatar Helper
  selectAvatar(seed) {
    const newAvatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`;
    document.getElementById('profile-avatar-preview').src = newAvatarUrl;
    window.ui.showToast('เลือก Avatar', 'เลือกรูปโปรไฟล์ใหม่แล้ว อย่าลืมกดบันทึกโปรไฟล์', 'info');
  }

  terminateSession(token) {
    window.db.removeActiveSession(token);
    const session = window.db.getCurrentSession();
    if (session) {
      window.ui.renderActiveSessions(session.userId);
      window.ui.showToast('สำเร็จ', 'ยกเลิกเซสชันที่เลือกเรียบร้อยแล้ว', 'success');
    }
  }

  resetDemoData() {
    window.db.resetDatabase();
    window.ui.showToast('รีเซ็ตข้อมูลแล้ว', 'ล้างข้อมูลแคชและรีเซ็ตรหัสผ่าน Demo เรียบร้อยแล้ว', 'success');
    setTimeout(() => {
      window.location.reload();
    }, 500);
  }

  setButtonLoading(button, isLoading) {
    if (!button) return;
    if (isLoading) {
      button.classList.add('loading');
      button.disabled = true;
    } else {
      button.classList.remove('loading');
      button.disabled = false;
    }
  }
}

window.app = new App();
