/* ==========================================================================
   Antigravity Auth - UI & DOM Presentation Controller
   ========================================================================== */

class UIController {
  constructor() {
    this.toastContainer = document.getElementById('toast-container');
  }

  // --- VIEW NAVIGATION ---
  showView(viewId) {
    const views = document.querySelectorAll('.view-section');
    views.forEach(v => v.classList.remove('active'));

    const targetView = document.getElementById(viewId);
    if (targetView) {
      targetView.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // --- TOAST NOTIFICATION SYSTEM ---
  showToast(title, message, type = 'info', duration = 4000) {
    if (!this.toastContainer) {
      this.toastContainer = document.createElement('div');
      this.toastContainer.id = 'toast-container';
      document.body.appendChild(this.toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconClass = 'fa-circle-info';
    if (type === 'success') iconClass = 'fa-circle-check';
    else if (type === 'error') iconClass = 'fa-triangle-exclamation';
    else if (type === 'warning') iconClass = 'fa-circle-exclamation';

    toast.innerHTML = `
      <div class="toast-icon"><i class="fa-solid ${iconClass}"></i></div>
      <div class="toast-content">
        <div class="toast-title">${window.security.sanitizeHTML(title)}</div>
        <div class="toast-message">${window.security.sanitizeHTML(message)}</div>
      </div>
      <button class="toast-close" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>
    `;

    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-hiding');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // --- PASSWORD STRENGTH METER RENDER ---
  updateStrengthMeter(inputElement, meterContainerId) {
    const password = inputElement.value;
    const strength = window.security.evaluatePasswordStrength(password);
    const container = document.getElementById(meterContainerId);
    if (!container) return;

    const segments = container.querySelectorAll('.strength-segment');
    const textLabel = container.querySelector('.strength-label');

    // Reset segments
    segments.forEach(s => s.style.backgroundColor = 'transparent');

    for (let i = 0; i < Math.min(strength.score, 5); i++) {
      if (segments[i]) {
        segments[i].style.backgroundColor = strength.color;
      }
    }

    if (textLabel) {
      textLabel.textContent = strength.text;
      textLabel.style.color = strength.color;
    }
  }

  // --- OTP AUTO-FOCUS HELPER ---
  setupOTPInputs(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const inputs = container.querySelectorAll('.otp-input');
    inputs.forEach((input, index) => {
      input.addEventListener('keyup', (e) => {
        if (e.key >= '0' && e.key <= '9') {
          if (index < inputs.length - 1) {
            inputs[index + 1].focus();
          }
        } else if (e.key === 'Backspace') {
          if (index > 0 && !input.value) {
            inputs[index - 1].focus();
          }
        }
      });

      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasteData = (e.clipboardData || window.clipboardData).getData('text').trim();
        if (/^\d{6}$/.test(pasteData)) {
          pasteData.split('').forEach((char, i) => {
            if (inputs[i]) inputs[i].value = char;
          });
          inputs[inputs.length - 1].focus();
        }
      });
    });
  }

  getOTPValue(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return '';
    const inputs = container.querySelectorAll('.otp-input');
    return Array.from(inputs).map(i => i.value).join('');
  }

  clearOTPInputs(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('.otp-input').forEach(i => i.value = '');
  }

  // --- DASHBOARD RENDERER ---
  renderDashboard(user) {
    // Sidebar User Summary
    document.getElementById('dash-user-name').textContent = user.fullName;
    document.getElementById('dash-user-role').textContent = user.role === 'admin' ? 'Administrator' : 'Verified User';
    document.getElementById('dash-user-avatar').src = user.avatar;

    // Stat Cards
    document.getElementById('stat-login-count').textContent = window.db.getAuditLogs(user.id).filter(l => l.action === 'LOGIN_SUCCESS').length;
    document.getElementById('stat-security-score').textContent = user.isTwoFactorEnabled ? '95 / 100' : '65 / 100';
    document.getElementById('stat-2fa-status').textContent = user.isTwoFactorEnabled ? 'เปิดใช้งาน (Enabled)' : 'ปิดใช้งาน (Disabled)';
    document.getElementById('stat-account-role').textContent = user.role.toUpperCase();

    // Profile Settings Form
    document.getElementById('profile-fullname-input').value = user.fullName;
    document.getElementById('profile-username-input').value = user.username;
    document.getElementById('profile-email-input').value = user.email;
    document.getElementById('profile-avatar-preview').src = user.avatar;

    // Security Settings
    const twoFactorToggle = document.getElementById('setting-2fa-toggle');
    if (twoFactorToggle) twoFactorToggle.checked = user.isTwoFactorEnabled;

    // JWT Token View
    const session = window.db.getCurrentSession();
    if (session && document.getElementById('jwt-token-display')) {
      document.getElementById('jwt-token-display').textContent = session.token;
    }

    // Audit Log Table
    this.renderAuditLogs(user.id);

    // Active Sessions Table
    this.renderActiveSessions(user.id);
  }

  renderAuditLogs(userId) {
    const tbody = document.getElementById('audit-log-tbody');
    if (!tbody) return;

    const logs = window.db.getAuditLogs(userId);
    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">ไม่พบประวัติการใช้งาน</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.map(log => {
      let badgeClass = 'badge-info';
      if (log.action.includes('SUCCESS') || log.action.includes('ENABLED')) badgeClass = 'badge-success';
      else if (log.action.includes('FAILED') || log.action.includes('LOCKOUT')) badgeClass = 'badge-danger';
      else if (log.action.includes('RESET') || log.action.includes('CHANGED')) badgeClass = 'badge-warning';

      const formattedTime = new Date(log.timestamp).toLocaleString('th-TH');

      return `
        <tr>
          <td><span class="badge ${badgeClass}">${log.action}</span></td>
          <td>${window.security.sanitizeHTML(log.details)}</td>
          <td><code>${log.ip}</code></td>
          <td><small class="text-muted">${formattedTime}</small></td>
        </tr>
      `;
    }).join('');
  }

  renderActiveSessions(userId) {
    const tbody = document.getElementById('active-sessions-tbody');
    if (!tbody) return;

    const sessions = window.db.getActiveSessions(userId);
    const currentSession = window.db.getCurrentSession();

    if (sessions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">ไม่มีเซสชันที่เปิดอยู่</td></tr>`;
      return;
    }

    tbody.innerHTML = sessions.map(s => {
      const isCurrent = currentSession && s.token === currentSession.token;
      const formattedTime = new Date(s.createdAt).toLocaleString('th-TH');

      return `
        <tr>
          <td>
            <strong>${window.security.sanitizeHTML(s.device)}</strong>
            ${isCurrent ? ' <span class="badge badge-success">อุปกรณ์นี้</span>' : ''}
          </td>
          <td><code>${s.ip}</code></td>
          <td><small class="text-muted">${formattedTime}</small></td>
          <td>
            ${!isCurrent ? `<button class="btn btn-secondary" style="padding: 0.2rem 0.6rem; font-size: 0.75rem;" onclick="window.app.terminateSession('${s.token}')">ยกเลิกเซสชัน</button>` : '<span class="text-muted">-</span>'}
          </td>
        </tr>
      `;
    }).join('');
  }
}

window.ui = new UIController();
