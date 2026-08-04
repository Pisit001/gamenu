/* ==========================================================================
   Antigravity Auth - Authentication Controller & Workflow
   ========================================================================== */

class AuthController {
  constructor() {
    this.pending2FAUser = null;
    this.pending2FAOTP = null;
    this.pendingResetEmail = null;
    this.pendingResetOTP = null;
  }

  // --- LOGIN ---
  async login(identifier, password, rememberMe = false) {
    if (!identifier || !password) {
      throw new Error('กรุณากรอกอีเมล/ชื่อผู้ใช้ และรหัสผ่าน');
    }

    const rateLimit = window.db.getRateLimit(identifier);
    if (rateLimit.lockedUntil && new Date(rateLimit.lockedUntil) > new Date()) {
      const remainingSeconds = Math.ceil((new Date(rateLimit.lockedUntil) - new Date()) / 1000);
      throw new Error(`บัญชีถูกล็อกชั่วคราวเนื่องจากพิมพ์รหัสผ่านผิดเกินกำหนด กรุณาลองใหม่ในอีก ${remainingSeconds} วินาที`);
    }

    const user = window.db.findUserByEmail(identifier);
    if (!user) {
      window.db.recordFailedAttempt(identifier);
      window.db.addAuditLog('guest', identifier, 'LOGIN_FAILED', 'User account not found');
      throw new Error('อีเมล/ชื่อผู้ใช้ หรือรหัสผ่านไม่ถูกต้อง');
    }

    // Verify Password Hash
    const hashedInput = await window.security.hashPassword(password, user.salt);
    if (hashedInput !== user.passwordHash) {
      const record = window.db.recordFailedAttempt(identifier);
      window.db.addAuditLog(user.id, user.username, 'LOGIN_FAILED', `Invalid password attempt (${record.attempts}/4)`);
      
      if (record.attempts >= 4) {
        throw new Error('พิมพ์รหัสผ่านผิดเกิน 4 ครั้ง! บัญชีถูกล็อกชั่วคราว 3 นาทีเพื่อความปลอดภัย');
      } else {
        throw new Error(`รหัสผ่านไม่ถูกต้อง (พยายามแล้ว ${record.attempts}/4 ครั้ง)`);
      }
    }

    // Clear Rate Limit on successful credentials
    window.db.clearRateLimit(identifier);

    // Check 2FA requirement
    if (user.isTwoFactorEnabled) {
      this.pending2FAUser = user;
      this.pending2FARemember = rememberMe;
      this.pending2FAOTP = window.security.generateOTP();
      
      console.log(`[SECURITY DEBUG] Simulated 2FA OTP Code for ${user.email}: ${this.pending2FAOTP}`);
      window.db.addAuditLog(user.id, user.username, '2FA_CHALLENGE', '2FA OTP Code generated');
      
      return { requires2FA: true, simulatedOTP: this.pending2FAOTP };
    }

    // Direct Login
    return this.completeLogin(user, rememberMe);
  }

  // Complete Login Flow
  completeLogin(user, rememberMe) {
    user.lastLogin = new Date().toISOString();
    window.db.saveUser(user);
    const session = window.db.setSession(user, rememberMe);
    window.db.addAuditLog(user.id, user.username, 'LOGIN_SUCCESS', 'Successful authentication');
    
    this.pending2FAUser = null;
    this.pending2FAOTP = null;
    return { success: true, session, user };
  }

  // --- VERIFY 2FA ---
  async verify2FA(otpCode) {
    if (!this.pending2FAUser || !this.pending2FAOTP) {
      throw new Error('ไม่พบข้อมูลการยืนยัน 2FA หรือเซสชันหมดอายุ');
    }

    if (!window.security.verifyOTP(otpCode, this.pending2FAOTP)) {
      window.db.addAuditLog(this.pending2FAUser.id, this.pending2FAUser.username, '2FA_FAILED', 'Invalid OTP code entered');
      throw new Error('รหัส OTP ไม่ถูกต้อง กรุณาตรวจสอบรหัสผ่านแอปพลิเคชันของคุณ');
    }

    const user = this.pending2FAUser;
    const rememberMe = this.pending2FARemember;
    window.db.addAuditLog(user.id, user.username, '2FA_SUCCESS', '2FA OTP code verified successfully');
    
    return this.completeLogin(user, rememberMe);
  }

  // --- REGISTRATION ---
  async register(username, email, password, fullName) {
    if (!username || !email || !password || !fullName) {
      throw new Error('กรุณากรอกข้อมูลให้ครบทุกช่อง');
    }

    // Email pattern check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('รูปแบบอีเมลไม่ถูกต้อง');
    }

    // Username pattern check
    if (username.length < 4 || !/^[a-zA-Z0-9_]+$/.test(username)) {
      throw new Error('ชื่อผู้ใช้ต้องมีความยาวอย่างน้อย 4 ตัวอักษรและประกอบด้วยตัวอักษรภาษาอังกฤษ ตัวเลข หรือ _ เท่านั้น');
    }

    // Password evaluation
    const strength = window.security.evaluatePasswordStrength(password);
    if (strength.score < 3) {
      throw new Error('รหัสผ่านยังไม่ปลอดภัยพอ กรุณาผสมตัวอักษรเล็ก ใหญ่ ตัวเลข หรืออักขระพิเศษ');
    }

    // Duplicate check
    const existing = window.db.findUserByEmail(email);
    if (existing) {
      throw new Error('อีเมลหรือชื่อผู้ใช้นี้ถูกใช้งานในระบบแล้ว');
    }

    const salt = window.security.generateSalt(16);
    const passwordHash = await window.security.hashPassword(password, salt);

    const newUser = {
      id: 'usr_' + Date.now(),
      username: username.trim(),
      email: email.trim().toLowerCase(),
      fullName: fullName.trim(),
      passwordHash,
      salt,
      role: 'user',
      isTwoFactorEnabled: false,
      twoFactorSecret: 'KVKXS2CVOR4X2ZCY',
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };

    window.db.saveUser(newUser);
    window.db.addAuditLog(newUser.id, newUser.username, 'REGISTER_SUCCESS', 'User account created');

    // Auto login
    return this.completeLogin(newUser, false);
  }

  // --- PASSWORD RESET ---
  async requestPasswordReset(email) {
    const user = window.db.findUserByEmail(email);
    if (!user) {
      // Security best practice: don't reveal user non-existence, but for demo UI feedback we simulate OTP
      throw new Error('ไม่พบบัญชีผู้ใช้ที่ใช้อีเมลนี้');
    }

    this.pendingResetEmail = user.email;
    this.pendingResetOTP = window.security.generateOTP();

    console.log(`[SECURITY DEBUG] Reset OTP for ${user.email}: ${this.pendingResetOTP}`);
    window.db.addAuditLog(user.id, user.username, 'PASSWORD_RESET_REQUEST', 'Reset OTP sent to email');

    return { success: true, simulatedOTP: this.pendingResetOTP, email: user.email };
  }

  async confirmPasswordReset(email, otpCode, newPassword) {
    if (!this.pendingResetEmail || this.pendingResetEmail.toLowerCase() !== email.toLowerCase()) {
      throw new Error('คำขอกู้คืนรหัสผ่านไม่ถูกต้อง หรือหมดอายุแล้ว');
    }

    if (!window.security.verifyOTP(otpCode, this.pendingResetOTP)) {
      throw new Error('รหัส OTP กู้คืนรหัสผ่านไม่ถูกต้อง');
    }

    const strength = window.security.evaluatePasswordStrength(newPassword);
    if (strength.score < 3) {
      throw new Error('รหัสผ่านใหม่ยังไม่ปลอดภัยพอ กรุณาตั้งรหัสผ่านใหม่ให้กู้คืนยากขึ้น');
    }

    const user = window.db.findUserByEmail(email);
    const salt = window.security.generateSalt(16);
    user.passwordHash = await window.security.hashPassword(newPassword, salt);
    user.salt = salt;

    window.db.saveUser(user);
    window.db.addAuditLog(user.id, user.username, 'PASSWORD_RESET_SUCCESS', 'Password reset successfully');

    this.pendingResetEmail = null;
    this.pendingResetOTP = null;

    return { success: true };
  }

  // --- PROFILE & SECURITY UPDATES ---
  async updateProfile(userId, fullName, avatar) {
    const user = window.db.findUserById(userId);
    if (!user) throw new Error('ไม่พบข้อมูลผู้ใช้');

    user.fullName = fullName.trim();
    if (avatar) user.avatar = avatar;

    window.db.saveUser(user);
    window.db.addAuditLog(user.id, user.username, 'PROFILE_UPDATED', 'User profile information updated');
    return user;
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = window.db.findUserById(userId);
    if (!user) throw new Error('ไม่พบข้อมูลผู้ใช้');

    const currentHash = await window.security.hashPassword(currentPassword, user.salt);
    if (currentHash !== user.passwordHash) {
      throw new Error('รหัสผ่านปัจจุบันไม่ถูกต้อง');
    }

    const strength = window.security.evaluatePasswordStrength(newPassword);
    if (strength.score < 3) {
      throw new Error('รหัสผ่านใหม่ยังไม่ปลอดภัยพอ');
    }

    const newSalt = window.security.generateSalt(16);
    user.passwordHash = await window.security.hashPassword(newPassword, newSalt);
    user.salt = newSalt;

    window.db.saveUser(user);
    window.db.addAuditLog(user.id, user.username, 'PASSWORD_CHANGED', 'User password changed successfully');
    return true;
  }

  async toggleTwoFactor(userId, enabled) {
    const user = window.db.findUserById(userId);
    if (!user) throw new Error('ไม่พบข้อมูลผู้ใช้');

    user.isTwoFactorEnabled = enabled;
    window.db.saveUser(user);

    window.db.addAuditLog(user.id, user.username, enabled ? '2FA_ENABLED' : '2FA_DISABLED', `2FA setting changed to ${enabled}`);
    return user;
  }

  logout() {
    const session = window.db.getCurrentSession();
    if (session) {
      window.db.addAuditLog(session.userId, session.username, 'LOGOUT', 'User logged out');
      window.db.clearSession();
    }
  }

  logoutAllDevices(userId) {
    const session = window.db.getCurrentSession();
    if (session) {
      window.db.removeAllActiveSessions(userId);
      window.db.addAuditLog(session.userId, session.username, 'LOGOUT_ALL_DEVICES', 'Terminated all active device sessions');
    }
  }
}

window.auth = new AuthController();
