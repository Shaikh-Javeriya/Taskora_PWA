'use client';

import { useState } from 'react';
import { LocalAuth } from '../lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Lock, Shield, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export default function AuthScreen({ onAuthenticated, isFirstLaunch }) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [enablePin, setEnablePin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSetupMode, setIsSetupMode] = useState(isFirstLaunch);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isSetupMode) {
        // Setup mode
        if (enablePin) {
          if (pin.length < 4) {
            toast.error('PIN must be at least 4 digits');
            return;
          }
          if (pin !== confirmPin) {
            toast.error('PINs do not match');
            return;
          }
          await LocalAuth.setUpPin(pin);
          toast.success('PIN set up successfully!');
        } else {
          // Skip PIN setup
          await LocalAuth.disablePin();
          toast.success('Welcome to Taskora!');
        }
        onAuthenticated();
      } else {
        // Login mode
        const isValid = await LocalAuth.verifyPin(pin);
        if (isValid) {
          toast.success('Welcome back!');
          onAuthenticated();
        } else {
          toast.error('Invalid PIN');
          setPin('');
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      toast.error('Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipPin = async () => {
    setIsLoading(true);
    try {
      await LocalAuth.disablePin();
      toast.success('Welcome to Taskora!');
      onAuthenticated();
    } catch (error) {
      console.error('Skip PIN error:', error);
      toast.error('Failed to skip PIN setup');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="w-20 h-20 gradient-bg rounded-2xl mx-auto flex items-center justify-center">
            <Sparkles className="h-10 w-10 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Taskora</h1>
            <p className="text-muted-foreground">
              {isSetupMode ? 'Welcome! Set up your workspace' : 'Welcome back!'}
            </p>
          </div>
        </div>

        {/* Auth Card */}
        <Card className="glass-card border-0">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center space-x-2">
              {isSetupMode ? <Shield className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
              <span>{isSetupMode ? 'Security Setup' : 'Enter PIN'}</span>
            </CardTitle>
            <CardDescription>
              {isSetupMode 
                ? 'Secure your workspace with an optional PIN'
                : 'Enter your PIN to access your workspace'
              }
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSetupMode && (
                <div className="flex items-center justify-between p-3 glass rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="text-base">Enable PIN Protection</Label>
                    <p className="text-sm text-muted-foreground">
                      Add extra security to your workspace
                    </p>
                  </div>
                  <Switch
                    checked={enablePin}
                    onCheckedChange={setEnablePin}
                  />
                </div>
              )}

              {(enablePin || !isSetupMode) && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="pin">
                      {isSetupMode ? 'Create PIN' : 'Enter PIN'}
                    </Label>
                    <Input
                      id="pin"
                      type="password"
                      placeholder={isSetupMode ? 'Create a 4-digit PIN' : 'Enter your PIN'}
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      maxLength={6}
                      className="text-center text-lg tracking-wider"
                      required={enablePin || !isSetupMode}
                      autoFocus
                    />
                  </div>

                  {isSetupMode && enablePin && (
                    <div className="space-y-2">
                      <Label htmlFor="confirmPin">Confirm PIN</Label>
                      <Input
                        id="confirmPin"
                        type="password"
                        placeholder="Confirm your PIN"
                        value={confirmPin}
                        onChange={(e) => setConfirmPin(e.target.value)}
                        maxLength={6}
                        className="text-center text-lg tracking-wider"
                        required
                      />
                    </div>
                  )}
                </>
              )}

              <div className="space-y-2 pt-2">
                <Button 
                  type="submit" 
                  className="w-full gradient-bg text-white hover:opacity-90"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Processing...</span>
                    </div>
                  ) : (
                    <span>
                      {isSetupMode 
                        ? (enablePin ? 'Set Up PIN' : 'Get Started') 
                        : 'Unlock Workspace'
                      }
                    </span>
                  )}
                </Button>

                {isSetupMode && enablePin && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full"
                    onClick={handleSkipPin}
                    disabled={isLoading}
                  >
                    Skip PIN Setup
                  </Button>
                )}
              </div>
            </form>

            {!isSetupMode && (
              <div className="mt-4 text-center">
                <p className="text-sm text-muted-foreground">
                  All your data is stored locally and private
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Features Preview */}
        {isSetupMode && (
          <Card className="glass border-0">
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-center space-y-2">
                  <div className="w-8 h-8 bg-blue-500/20 rounded-lg mx-auto flex items-center justify-center">
                    <Shield className="h-4 w-4 text-blue-500" />
                  </div>
                  <p className="font-medium">100% Local</p>
                  <p className="text-muted-foreground text-xs">Your data never leaves your device</p>
                </div>
                <div className="text-center space-y-2">
                  <div className="w-8 h-8 bg-green-500/20 rounded-lg mx-auto flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-green-500" />
                  </div>
                  <p className="font-medium">Works Offline</p>
                  <p className="text-muted-foreground text-xs">No internet connection needed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
