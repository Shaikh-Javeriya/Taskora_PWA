'use client';

// PWA utilities for Taskora
export class PWAManager {
  static async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        // Register service worker
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });
        
        console.log('Service Worker registered successfully:', registration.scope);
        
        // Handle updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available
                this.showUpdateNotification();
              }
            });
          }
        });
        
        return registration;
      } catch (error) {
        console.error('Service Worker registration failed:', error);
        return null;
      }
    }
    return null;
  }
  
  static showUpdateNotification() {
    if (confirm('A new version of Taskora is available. Would you like to update?')) {
      window.location.reload();
    }
  }
  
  static async requestNotificationPermission() {
    if ('Notification' in window && 'serviceWorker' in navigator) {
      try {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      } catch (error) {
        console.error('Notification permission request failed:', error);
        return false;
      }
    }
    return false;
  }
  
  static async showNotification(title, options = {}) {
    if ('serviceWorker' in navigator && Notification.permission === 'granted') {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, {
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
          ...options
        });
      } catch (error) {
        console.error('Show notification failed:', error);
      }
    }
  }
  
  static async scheduleDeadlineNotifications() {
    // Import database operations
    const { dbOperations } = await import('./database');
    
    try {
      const tasks = await dbOperations.getTasks();
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      // Find tasks due tomorrow
      const upcomingTasks = tasks.filter(task => 
        task.deadline && 
        task.status !== 'done' &&
        new Date(task.deadline) <= tomorrow &&
        new Date(task.deadline) > now
      );
      
      // Show notifications for upcoming deadlines
      for (const task of upcomingTasks) {
        const timeUntilDeadline = new Date(task.deadline) - now;
        const hoursUntil = Math.floor(timeUntilDeadline / (1000 * 60 * 60));
        
        await this.showNotification('Upcoming Deadline', {
          body: `"${task.title}" is due in ${hoursUntil} hours`,
          tag: `deadline-${task.id}`,
          actions: [
            { action: 'view', title: 'View Task' },
            { action: 'dismiss', title: 'Dismiss' }
          ]
        });
      }
    } catch (error) {
      console.error('Deadline notification scheduling failed:', error);
    }
  }
  
  static isInstallable() {
    return window.deferredPrompt !== undefined;
  }
  
  static async installApp() {
    if (window.deferredPrompt) {
      try {
        window.deferredPrompt.prompt();
        const { outcome } = await window.deferredPrompt.userChoice;
        window.deferredPrompt = null;
        return outcome === 'accepted';
      } catch (error) {
        console.error('App installation failed:', error);
        return false;
      }
    }
    return false;
  }
  
  static async getStorageUsage() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        return {
          used: estimate.usage || 0,
          quota: estimate.quota || 0,
          usedMB: Math.round((estimate.usage || 0) / (1024 * 1024) * 100) / 100,
          quotaMB: Math.round((estimate.quota || 0) / (1024 * 1024) * 100) / 100
        };
      } catch (error) {
        console.error('Storage estimate failed:', error);
      }
    }
    return null;
  }
  
  static isOnline() {
    return navigator.onLine;
  }
  
  static addOnlineListener(callback) {
    window.addEventListener('online', callback);
    window.addEventListener('offline', callback);
    
    // Return cleanup function
    return () => {
      window.removeEventListener('online', callback);
      window.removeEventListener('offline', callback);
    };
  }
}

// Install prompt handling
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Save the event for later use
    window.deferredPrompt = e;
  });
  
  window.addEventListener('appinstalled', () => {
    console.log('Taskora PWA was installed');
    window.deferredPrompt = null;
  });
}
