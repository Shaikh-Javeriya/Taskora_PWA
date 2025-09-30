'use client';

import { useEffect, useState } from 'react';
import { initializeDatabase, dbOperations } from '../lib/database';
import { LocalAuth, ThemeManager } from '../lib/auth';
import { PWAManager } from '../lib/pwa';
import Dashboard from '../components/Dashboard';
import AuthScreen from '../components/AuthScreen';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      try {
        // Initialize PWA service worker
        await PWAManager.registerServiceWorker();
        
        // Initialize database and theme
        await initializeDatabase();
        await ThemeManager.initializeTheme();
        
        // Check authentication status
        const pinSetUp = await LocalAuth.isSetUp();
        const authenticated = await LocalAuth.isAuthenticated();
        
        setNeedsSetup(!pinSetUp);
        setIsAuthenticated(authenticated);
        
        // Check if this is first launch
        const firstLaunch = await dbOperations.getSetting('first_launch');
        if (firstLaunch === true) {
          await dbOperations.setSetting('first_launch', false);
          
          // Only show welcome if user is authenticated (either no PIN or valid session)
          if (authenticated || !pinSetUp) {
            toast.success('Welcome to Taskora!', {
              description: 'Your local-first project management dashboard is ready.'
            });
            
            // Request notification permission on first launch
            if (window.Notification && Notification.permission === 'default') {
              setTimeout(async () => {
                const granted = await PWAManager.requestNotificationPermission();
                if (granted) {
                  toast.success('Notifications enabled!', {
                    description: 'You\'ll receive reminders for upcoming deadlines.'
                  });
                }
              }, 3000);
            }
          }
        }
        
        // Schedule deadline notifications if authenticated
        if (authenticated && window.Notification && Notification.permission === 'granted') {
          await PWAManager.scheduleDeadlineNotifications();
        }
        
      } catch (error) {
        console.error('Initialization error:', error);
        toast.error('Failed to initialize app', {
          description: 'Please refresh the page to try again.'
        });
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  const handleAuthenticated = () => {
    setIsAuthenticated(true);
    setNeedsSetup(false);
  };

  const handleLogout = async () => {
    await LocalAuth.logout();
    setIsAuthenticated(false);
    const pinSetUp = await LocalAuth.isSetUp();
    setNeedsSetup(!pinSetUp);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-card rounded-xl p-8">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-lg font-medium">Loading Taskora...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <AuthScreen onAuthenticated={handleAuthenticated} needsSetup={needsSetup} />
        <Toaster />
      </>
    );
  }

  return (
    <>
      <Dashboard onLogout={handleLogout} />
      <Toaster />
    </>
  );
}
