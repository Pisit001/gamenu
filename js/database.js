/* ==========================================================================
   Antigravity Auth - Database & Storage Module
   Simulates persistent storage using LocalStorage & Data Models
   ========================================================================== */

const DB_KEYS = {
  USERS: 'antigravity_auth_users',
  SESSION: 'antigravity_auth_session',
  AUDIT_LOGS: 'antigravity_auth_audit_logs',
  ACTIVE_SESSIONS: 'antigravity_auth_active_sessions',
  RATE_LIMITS: 'antigravity_auth_rate_limits'
};

class AuthDatabase {
  constructor() {
    this.initDatabase();
  }

  // Initialize DB with seed accounts if empty
  initDatabase() {
    const defaultUsers = [
      {
        id: 'usr_demo_01',
        username: 'demo_user',
        email: 'user@antigravity.dev',
        fullName: 'Somchai Jaidee',
        // Password: 'Password123!' -> salted SHA-256 hash: aa01d1334a586462d143e0c17adf8fd11fec91c7f18c799996d09bc809542cab
        passwordHash: 'aa01d1334a586462d143e0c17adf8fd11fec91c7f18c799996d09bc809542cab',
        salt: 'antigravity_salt_2026',
        role: 'user',
        isTwoFactorEnabled: false,
        twoFactorSecret: 'KVKXS2CVOR4X2ZCY',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Somchai',
        createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
        lastLogin: new Date().toISOString()
      },
      {
        id: 'usr_admin_02',
        username: 'admin_sys',
        email: 'admin@antigravity.dev',
        fullName: 'Security Administrator',
        // Password: 'AdminPassword123!' -> salted SHA-256 hash: dcfa14e4d4beae19c6d1d8e4773cd37519efc225c04b849e82d9d4c8172b0fa7
        passwordHash: 'dcfa14e4d4beae19c6d1d8e4773cd37519efc225c04b849e82d9d4c8172b0fa7',
        salt: 'antigravity_admin_salt_2026',
        role: 'admin',
        isTwoFactorEnabled: true,
        twoFactorSecret: 'JBSWY3DPEHPK3PXP',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Admin',
        createdAt: new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString(),
        lastLogin: new Date().toISOString()
      }
    ];

    if (!localStorage.getItem(DB_KEYS.USERS)) {
      localStorage.setItem(DB_KEYS.USERS, JSON.stringify(defaultUsers));
    } else {
      // Auto repair demo users hashes in existing LocalStorage
      const users = JSON.parse(localStorage.getItem(DB_KEYS.USERS));
      let updated = false;
      users.forEach(u => {
        if (u.id === 'usr_demo_01' && u.passwordHash !== 'aa01d1334a586462d143e0c17adf8fd11fec91c7f18c799996d09bc809542cab') {
          u.passwordHash = 'aa01d1334a586462d143e0c17adf8fd11fec91c7f18c799996d09bc809542cab';
          u.salt = 'antigravity_salt_2026';
          updated = true;
        }
        if (u.id === 'usr_admin_02' && u.passwordHash !== 'dcfa14e4d4beae19c6d1d8e4773cd37519efc225c04b849e82d9d4c8172b0fa7') {
          u.passwordHash = 'dcfa14e4d4beae19c6d1d8e4773cd37519efc225c04b849e82d9d4c8172b0fa7';
          u.salt = 'antigravity_admin_salt_2026';
          updated = true;
        }
      });
      if (updated) {
        localStorage.setItem(DB_KEYS.USERS, JSON.stringify(users));
      }
    }

    if (!localStorage.getItem(DB_KEYS.AUDIT_LOGS)) {
      const defaultLogs = [
        {
          id: 'log_001',
          userId: 'usr_demo_01',
          username: 'demo_user',
          action: 'LOGIN_SUCCESS',
          details: 'Initial login from Chrome (Windows)',
          ip: '192.168.1.102',
          timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
        },
        {
          id: 'log_002',
          userId: 'usr_admin_02',
          username: 'admin_sys',
          action: '2FA_ENABLED',
          details: 'Two-Factor Authentication enabled',
          ip: '192.168.1.100',
          timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString()
        }
      ];
      localStorage.setItem(DB_KEYS.AUDIT_LOGS, JSON.stringify(defaultLogs));
    }

    if (!localStorage.getItem(DB_KEYS.ACTIVE_SESSIONS)) {
      localStorage.setItem(DB_KEYS.ACTIVE_SESSIONS, JSON.stringify([]));
    }

    if (!localStorage.getItem(DB_KEYS.RATE_LIMITS)) {
      localStorage.setItem(DB_KEYS.RATE_LIMITS, JSON.stringify({}));
    }
  }

  // --- USER OPERATIONS ---
  getUsers() {
    return JSON.parse(localStorage.getItem(DB_KEYS.USERS) || '[]');
  }

  findUserByEmail(email) {
    const users = this.getUsers();
    return users.find(u => u.email.toLowerCase() === email.trim().toLowerCase() || u.username.toLowerCase() === email.trim().toLowerCase());
  }

  findUserById(id) {
    const users = this.getUsers();
    return users.find(u => u.id === id);
  }

  saveUser(user) {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === user.id);
    if (index !== -1) {
      users[index] = user;
    } else {
      users.push(user);
    }
    localStorage.setItem(DB_KEYS.USERS, JSON.stringify(users));
  }

  // --- SESSION MANAGEMENT ---
  getCurrentSession() {
    const sessionStr = localStorage.getItem(DB_KEYS.SESSION);
    if (!sessionStr) return null;
    try {
      const session = JSON.parse(sessionStr);
      // Check expiration (24 hours)
      if (new Date(session.expiresAt) < new Date()) {
        this.clearSession();
        return null;
      }
      return session;
    } catch (e) {
      return null;
    }
  }

  setSession(user, rememberMe = false) {
    const durationHours = rememberMe ? 7 * 24 : 24;
    const expiresAt = new Date(Date.now() + durationHours * 3600 * 1000).toISOString();
    
    // Generate simulated JWT Token
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = btoa(JSON.stringify({ sub: user.id, email: user.email, role: user.role, exp: expiresAt }));
    const signature = btoa(user.id + "_" + Date.now());
    const token = `${header}.${payload}.${signature}`;

    const sessionData = {
      token,
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      expiresAt,
      device: this.getDeviceSummary()
    };

    localStorage.setItem(DB_KEYS.SESSION, JSON.stringify(sessionData));

    // Register active session
    this.addActiveSession(user.id, token, sessionData.device);
    return sessionData;
  }

  clearSession() {
    const session = this.getCurrentSession();
    if (session) {
      this.removeActiveSession(session.token);
    }
    localStorage.removeItem(DB_KEYS.SESSION);
  }

  // --- ACTIVE SESSIONS ---
  getActiveSessions(userId) {
    const sessions = JSON.parse(localStorage.getItem(DB_KEYS.ACTIVE_SESSIONS) || '[]');
    return sessions.filter(s => s.userId === userId);
  }

  addActiveSession(userId, token, device) {
    const sessions = JSON.parse(localStorage.getItem(DB_KEYS.ACTIVE_SESSIONS) || '[]');
    sessions.push({
      token,
      userId,
      device,
      ip: '192.168.1.' + Math.floor(Math.random() * 150 + 10),
      createdAt: new Date().toISOString()
    });
    localStorage.setItem(DB_KEYS.ACTIVE_SESSIONS, JSON.stringify(sessions));
  }

  removeActiveSession(token) {
    let sessions = JSON.parse(localStorage.getItem(DB_KEYS.ACTIVE_SESSIONS) || '[]');
    sessions = sessions.filter(s => s.token !== token);
    localStorage.setItem(DB_KEYS.ACTIVE_SESSIONS, JSON.stringify(sessions));
  }

  removeAllActiveSessions(userId) {
    let sessions = JSON.parse(localStorage.getItem(DB_KEYS.ACTIVE_SESSIONS) || '[]');
    const currentSession = this.getCurrentSession();
    // Keep current session or clear all
    sessions = sessions.filter(s => s.userId !== userId || (currentSession && s.token === currentSession.token));
    localStorage.setItem(DB_KEYS.ACTIVE_SESSIONS, JSON.stringify(sessions));
  }

  // --- AUDIT LOGS ---
  getAuditLogs(userId = null) {
    const logs = JSON.parse(localStorage.getItem(DB_KEYS.AUDIT_LOGS) || '[]');
    if (userId) {
      return logs.filter(l => l.userId === userId).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
    return logs.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  addAuditLog(userId, username, action, details) {
    const logs = JSON.parse(localStorage.getItem(DB_KEYS.AUDIT_LOGS) || '[]');
    logs.unshift({
      id: 'log_' + Date.now() + '_' + Math.floor(Math.random()*1000),
      userId,
      username,
      action,
      details,
      ip: '127.0.0.1 (Localhost)',
      timestamp: new Date().toISOString()
    });
    // Keep max 100 logs
    if (logs.length > 100) logs.pop();
    localStorage.setItem(DB_KEYS.AUDIT_LOGS, JSON.stringify(logs));
  }

  // --- RATE LIMITING & LOCKOUT ---
  getRateLimit(identifier) {
    const limits = JSON.parse(localStorage.getItem(DB_KEYS.RATE_LIMITS) || '{}');
    return limits[identifier] || { attempts: 0, lockedUntil: null };
  }

  recordFailedAttempt(identifier) {
    const limits = JSON.parse(localStorage.getItem(DB_KEYS.RATE_LIMITS) || '{}');
    const record = limits[identifier] || { attempts: 0, lockedUntil: null };
    
    record.attempts += 1;
    if (record.attempts >= 4) {
      // Lock out for 3 minutes
      record.lockedUntil = new Date(Date.now() + 3 * 60 * 1000).toISOString();
    }
    limits[identifier] = record;
    localStorage.setItem(DB_KEYS.RATE_LIMITS, JSON.stringify(limits));
    return record;
  }

  clearRateLimit(identifier) {
    const limits = JSON.parse(localStorage.getItem(DB_KEYS.RATE_LIMITS) || '{}');
    delete limits[identifier];
    localStorage.setItem(DB_KEYS.RATE_LIMITS, JSON.stringify(limits));
  }

  // Utility to parse User Agent
  getDeviceSummary() {
    const ua = navigator.userAgent;
    let browser = "Browser";
    if (ua.includes("Chrome")) browser = "Chrome";
    else if (ua.includes("Firefox")) browser = "Firefox";
    else if (ua.includes("Safari")) browser = "Safari";
    else if (ua.includes("Edg")) browser = "Edge";

    let os = "Desktop";
    if (ua.includes("Windows")) os = "Windows";
    else if (ua.includes("Mac")) os = "macOS";
    else if (ua.includes("Linux")) os = "Linux";
    else if (ua.includes("Android")) os = "Android";
    else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

    return `${browser} on ${os}`;
  }

  // Reset all database keys and re-initialize default users
  resetDatabase() {
    localStorage.removeItem(DB_KEYS.USERS);
    localStorage.removeItem(DB_KEYS.SESSION);
    localStorage.removeItem(DB_KEYS.AUDIT_LOGS);
    localStorage.removeItem(DB_KEYS.ACTIVE_SESSIONS);
    localStorage.removeItem(DB_KEYS.RATE_LIMITS);
    this.initDatabase();
  }
}

window.db = new AuthDatabase();
