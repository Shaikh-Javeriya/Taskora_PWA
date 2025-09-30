'use client';

import { useEffect, useState } from 'react';
import { initializeDatabase, dbOperations } from '../lib/database';
import { LocalAuth, ThemeManager } from '../lib/auth';
import Dashboard from '../components/Dashboard';
import AuthScreen from '../components/AuthScreen';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [isFirstLaunch, setIsFirstLaunch] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      try {
        // Initialize database and theme
        await initializeDatabase();
        await ThemeManager.initializeTheme();
        
        // Check if this is first launch
        const firstLaunch = await dbOperations.getSetting('first_launch');
        setIsFirstLaunch(firstLaunch === true);
        
        // Check authentication status
        const pinSetUp = await LocalAuth.isSetUp();
        const authenticated = LocalAuth.isAuthenticated();
        
        setNeedsAuth(pinSetUp && !authenticated);
        setIsAuthenticated(!pinSetUp || authenticated);
        
        // Show welcome message on first launch
        if (firstLaunch === true) {
          toast.success('Welcome to Taskora!', {
            description: 'Your local-first project management dashboard is ready.'
          });
          await dbOperations.setSetting('first_launch', false);
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
    setNeedsAuth(false);
  };

  const handleLogout = async () => {
    await LocalAuth.logout();
    setIsAuthenticated(false);
    const pinSetUp = await LocalAuth.isSetUp();
    setNeedsAuth(pinSetUp);
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

  if (needsAuth || !isAuthenticated) {
    return (
      <>
        <AuthScreen onAuthenticated={handleAuthenticated} isFirstLaunch={isFirstLaunch} />
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
