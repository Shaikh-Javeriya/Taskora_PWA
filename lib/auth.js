import { dbOperations } from './database';

// Simple local authentication
export class LocalAuth {
  static async isSetUp() {
    const pinEnabled = await dbOperations.getSetting('pin_enabled');
    return pinEnabled === true;
  }
  
  static async setUpPin(pin) {
    const pinHash = await this.hashPin(pin);
    await dbOperations.setSetting('pin_enabled', true);
    await dbOperations.setSetting('pin_hash', pinHash);
    localStorage.setItem('taskora_authenticated', 'true');
    return true;
  }
  
  static async verifyPin(pin) {
    const storedHash = await dbOperations.getSetting('pin_hash');
    const inputHash = await this.hashPin(pin);
    
    if (storedHash === inputHash) {
      localStorage.setItem('taskora_authenticated', 'true');
      return true;
    }
    return false;
  }
  
  static isAuthenticated() {
    return localStorage.getItem('taskora_authenticated') === 'true';
  }
  
  static async logout() {
    localStorage.removeItem('taskora_authenticated');
  }
  
  static async disablePin() {
    await dbOperations.setSetting('pin_enabled', false);
    await dbOperations.setSetting('pin_hash', '');
    localStorage.setItem('taskora_authenticated', 'true');
  }
  
  static async hashPin(pin) {
    // Simple hash for local storage (not cryptographically secure)
    const encoder = new TextEncoder();
    const data = encoder.encode(pin + 'taskora_salt');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
