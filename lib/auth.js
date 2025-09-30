import db from './database';

// Secure PIN-based authentication system
export class LocalAuth {
  static AUTH_ID = 'localAuth';
  static SESSION_ID = 'currentSession';
  static ITERATIONS = 150000;
  static MAX_FAILED_ATTEMPTS = 5;
  static MIN_PIN_LENGTH = 4;
  static MAX_PIN_LENGTH = 6;
  
  // Check if PIN has been set up
  static async isSetUp() {
    try {
      const authRecord = await db.auth.get(this.AUTH_ID);
      return authRecord && authRecord.pinHash;
    } catch (error) {
      console.error('Error checking PIN setup:', error);
      return false;
    }
  }
  
  // Check if user is currently authenticated
  static async isAuthenticated() {
    try {
      const session = await db.session.get(this.SESSION_ID);
      if (!session) return false;
      
      // Check if session is expired
      if (session.expiresAt && Date.now() > session.expiresAt) {
        await this.logout();
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error checking authentication:', error);
      return false;
    }
  }
  
  // Check if account is locked due to failed attempts
  static async isLocked() {
    try {
      const authRecord = await db.auth.get(this.AUTH_ID);
      if (!authRecord) return false;
      
      if (authRecord.lockoutUntil && Date.now() < authRecord.lockoutUntil) {
        return {
          locked: true,
          unlockAt: authRecord.lockoutUntil,
          remainingMs: authRecord.lockoutUntil - Date.now()
        };
      }
      
      return { locked: false };
    } catch (error) {
      console.error('Error checking lock status:', error);
      return { locked: false };
    }
  }
  
  // Generate a cryptographically secure salt
  static generateSalt() {
    const saltBytes = new Uint8Array(16);
    crypto.getRandomValues(saltBytes);
    return btoa(String.fromCharCode.apply(null, saltBytes));
  }
  
  // Derive key using PBKDF2
  static async deriveKey(pin, salt, iterations = this.ITERATIONS) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(pin),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    
    const saltBytes = Uint8Array.from(atob(salt), c => c.charCodeAt(0));
    
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations: iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );
    
    return btoa(String.fromCharCode.apply(null, new Uint8Array(derivedBits)));
  }
  
  // Constant-time comparison to prevent timing attacks
  static constantTimeCompare(a, b) {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }
  
  // Validate PIN format
  static validatePin(pin) {
    if (!pin) return { valid: false, error: 'PIN is required' };
    if (!/^\d+$/.test(pin)) return { valid: false, error: 'PIN must contain only digits' };
    if (pin.length < this.MIN_PIN_LENGTH) return { valid: false, error: `PIN must be at least ${this.MIN_PIN_LENGTH} digits` };
    if (pin.length > this.MAX_PIN_LENGTH) return { valid: false, error: `PIN must be no more than ${this.MAX_PIN_LENGTH} digits` };
    return { valid: true };
  }
  
  // Set up PIN for first time
  static async setUpPin(pin, confirmPin) {
    const validation = this.validatePin(pin);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    if (pin !== confirmPin) {
      throw new Error('PINs do not match');
    }
    
    // Check if PIN already exists
    const existing = await db.auth.get(this.AUTH_ID);
    if (existing && existing.pinHash) {
      throw new Error('PIN already exists. Use changePin to update.');
    }
    
    const salt = this.generateSalt();
    const pinHash = await this.deriveKey(pin, salt);
    
    await db.auth.put({
      id: this.AUTH_ID,
      pinHash,
      salt,
      iterations: this.ITERATIONS,
      createdAt: Date.now(),
      failedAttempts: 0,
      lockoutUntil: null
    });
    
    await this.createSession();
    return true;
  }
  
  // Verify PIN for login
  static async verifyPin(pin) {
    const validation = this.validatePin(pin);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    const authRecord = await db.auth.get(this.AUTH_ID);
    if (!authRecord || !authRecord.pinHash) {
      throw new Error('No PIN configured');
    }
    
    // Check lockout
    const lockStatus = await this.isLocked();
    if (lockStatus.locked) {
      const remainingMinutes = Math.ceil(lockStatus.remainingMs / (1000 * 60));
      throw new Error(`Account locked. Try again in ${remainingMinutes} minute(s).`);
    }
    
    const inputHash = await this.deriveKey(pin, authRecord.salt, authRecord.iterations);
    const isValid = this.constantTimeCompare(authRecord.pinHash, inputHash);
    
    if (isValid) {
      // Reset failed attempts on successful login
      await db.auth.update(this.AUTH_ID, {
        failedAttempts: 0,
        lockoutUntil: null
      });
      
      await this.createSession();
      return true;
    } else {
      // Increment failed attempts
      const newFailedAttempts = (authRecord.failedAttempts || 0) + 1;
      let lockoutUntil = null;
      
      if (newFailedAttempts >= this.MAX_FAILED_ATTEMPTS) {
        // Calculate exponential lockout: 5m, 10m, 30m, 2h, 24h
        const lockoutMinutes = Math.min(5 * Math.pow(2, newFailedAttempts - this.MAX_FAILED_ATTEMPTS), 24 * 60);
        lockoutUntil = Date.now() + (lockoutMinutes * 60 * 1000);
      }
      
      await db.auth.update(this.AUTH_ID, {
        failedAttempts: newFailedAttempts,
        lockoutUntil
      });
      
      if (lockoutUntil) {
        const lockoutMinutes = Math.ceil((lockoutUntil - Date.now()) / (1000 * 60));
        throw new Error(`Too many failed attempts. Account locked for ${lockoutMinutes} minute(s).`);
      } else {
        const remaining = this.MAX_FAILED_ATTEMPTS - newFailedAttempts;
        throw new Error(`Invalid PIN. ${remaining} attempt(s) remaining before lockout.`);
      }
    }
  }
  
  // Change existing PIN
  static async changePin(oldPin, newPin, confirmNewPin) {
    const validation = this.validatePin(newPin);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    if (newPin !== confirmNewPin) {
      throw new Error('New PINs do not match');
    }
    
    // Verify old PIN first
    const authRecord = await db.auth.get(this.AUTH_ID);
    if (!authRecord || !authRecord.pinHash) {
      throw new Error('No PIN configured');
    }
    
    const inputHash = await this.deriveKey(oldPin, authRecord.salt, authRecord.iterations);
    const isValid = this.constantTimeCompare(authRecord.pinHash, inputHash);
    
    if (!isValid) {
      throw new Error('Current PIN is incorrect');
    }
    
    const salt = this.generateSalt();
    const pinHash = await this.deriveKey(newPin, salt);
    
    await db.auth.update(this.AUTH_ID, {
      pinHash,
      salt,
      iterations: this.ITERATIONS,
      failedAttempts: 0,
      lockoutUntil: null
    });
    
    return true;
  }
  
  // Reset PIN (forgot PIN flow)
  static async resetPin(newPin, confirmNewPin, wipeData = false) {
    const validation = this.validatePin(newPin);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    if (newPin !== confirmNewPin) {
      throw new Error('PINs do not match');
    }
    
    if (wipeData) {
      // Clear all data except auth table
      await db.transaction('rw', [db.projects, db.tasks, db.time_entries, db.settings, db.session], async () => {
        await db.projects.clear();
        await db.tasks.clear();
        await db.time_entries.clear();
        await db.settings.clear();
        await db.session.clear();
      });
      
      // Reinitialize default settings
      const { initializeDatabase } = await import('./database');
      await initializeDatabase();
    }
    
    const salt = this.generateSalt();
    const pinHash = await this.deriveKey(newPin, salt);
    
    await db.auth.put({
      id: this.AUTH_ID,
      pinHash,
      salt,
      iterations: this.ITERATIONS,
      createdAt: Date.now(),
      failedAttempts: 0,
      lockoutUntil: null
    });
    
    await this.createSession();
    return true;
  }
  
  // Disable PIN protection entirely
  static async disablePin(currentPin) {
    if (currentPin) {
      // Verify current PIN first
      const authRecord = await db.auth.get(this.AUTH_ID);
      if (authRecord && authRecord.pinHash) {
        const inputHash = await this.deriveKey(currentPin, authRecord.salt, authRecord.iterations);
        const isValid = this.constantTimeCompare(authRecord.pinHash, inputHash);
        
        if (!isValid) {
          throw new Error('Current PIN is incorrect');
        }
      }
    }
    
    // Remove auth record
    await db.auth.delete(this.AUTH_ID);
    
    // Create permanent session (no PIN protection)
    await this.createSession(true);
    return true;
  }
  
  // Create session
  static async createSession(permanent = false) {
    const session = {
      id: this.SESSION_ID,
      token: crypto.randomUUID(),
      createdAt: Date.now(),
      expiresAt: permanent ? null : Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
    };
    
    await db.session.put(session);
    return session;
  }
  
  // Logout
  static async logout() {
    try {
      await db.session.delete(this.SESSION_ID);
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }
  
  // Get failed attempts info
  static async getFailedAttemptsInfo() {
    try {
      const authRecord = await db.auth.get(this.AUTH_ID);
      return {
        failedAttempts: authRecord?.failedAttempts || 0,
        maxAttempts: this.MAX_FAILED_ATTEMPTS,
        remaining: Math.max(0, this.MAX_FAILED_ATTEMPTS - (authRecord?.failedAttempts || 0))
      };
    } catch (error) {
      return { failedAttempts: 0, maxAttempts: this.MAX_FAILED_ATTEMPTS, remaining: this.MAX_FAILED_ATTEMPTS };
    }
  }
}

// Theme management
export class ThemeManager {
  static themes = {
    blue: {
      name: 'Blue Gradient',
      '--accent-1': '#60A5FA',
      '--accent-2': '#3B82F6',
      '--accent-3': '#1E3A8A',
      '--gradient': 'linear-gradient(90deg, #60A5FA 0%, #1E3A8A 100%)'
    },
    green: {
      name: 'Green Gradient',
      '--accent-1': '#86EFAC',
      '--accent-2': '#34D399',
      '--accent-3': '#047857',
      '--gradient': 'linear-gradient(90deg, #86EFAC 0%, #047857 100%)'
    },
    purple: {
      name: 'Purple Gradient',
      '--accent-1': '#E9D5FF',
      '--accent-2': '#A78BFA',
      '--accent-3': '#6D28D9',
      '--gradient': 'linear-gradient(90deg, #E9D5FF 0%, #6D28D9 100%)'
    },
    teal: {
      name: 'Teal Gradient',
      '--accent-1': '#99F6E4',
      '--accent-2': '#2DD4BF',
      '--accent-3': '#0F766E',
      '--gradient': 'linear-gradient(90deg, #99F6E4 0%, #0F766E 100%)'
    }
  };
  
  static async getCurrentTheme() {
    const theme = await dbOperations.getSetting('theme');
    return theme || 'blue';
  }
  
  static async setTheme(themeName) {
    if (!this.themes[themeName]) return false;
    
    await dbOperations.setSetting('theme', themeName);
    this.applyTheme(themeName);
    return true;
  }
  
  static applyTheme(themeName) {
    const theme = this.themes[themeName];
    if (!theme) return;
    
    const root = document.documentElement;
    Object.entries(theme).forEach(([key, value]) => {
      if (key !== 'name') {
        root.style.setProperty(key, value);
      }
    });
    
    // Update body class for theme-specific styles
    document.body.className = document.body.className.replace(/theme-\w+/g, '');
    document.body.classList.add(`theme-${themeName}`);
  }
  
  static async initializeTheme() {
    const currentTheme = await this.getCurrentTheme();
    this.applyTheme(currentTheme);
  }
}
