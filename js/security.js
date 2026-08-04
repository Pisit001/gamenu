/* ==========================================================================
   Antigravity Auth - Cryptography & Security Engine
   Handles Web Crypto API SHA-256 Hashing, Password Strength, 2FA & Sanitization
   ========================================================================== */

class SecurityEngine {
  // SHA-256 Hashing with Salt
  async hashPassword(password, salt = 'antigravity_default_salt') {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Generate random salt
  generateSalt(length = 16) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }

  // Evaluate password strength
  evaluatePasswordStrength(password) {
    if (!password) return { score: 0, text: 'ยังไม่ได้ระบุ', color: 'transparent', width: '0%' };

    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    let result = { score, text: 'อ่อนมาก (Weak)', color: 'var(--accent-rose)', width: '20%' };

    if (score >= 5) {
      result = { score, text: 'แข็งแกร่งมาก (Strong)', color: 'var(--accent-emerald)', width: '100%' };
    } else if (score >= 4) {
      result = { score, text: 'ปานกลาง (Medium)', color: 'var(--accent-cyan)', width: '75%' };
    } else if (score >= 3) {
      result = { score, text: 'พอใช้ (Fair)', color: 'var(--accent-amber)', width: '50%' };
    } else if (score >= 2) {
      result = { score, text: 'อ่อน (Weak)', color: '#f97316', width: '35%' };
    }

    return result;
  }

  // Generate simulated 6-digit OTP code for 2FA
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Verify OTP
  verifyOTP(userProvided, actualCode) {
    return userProvided.trim() === actualCode.trim();
  }

  // Escape HTML to prevent XSS
  sanitizeHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"']/g, function(m) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[m];
    });
  }
}

window.security = new SecurityEngine();
