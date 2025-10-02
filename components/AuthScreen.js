'use client';

import { useState, useEffect } from 'react';
import { LocalAuth } from '../lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Lock, Shield, Sparkles, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function AuthScreen({ onAuthenticated, needsSetup }) {
  const [mode, setMode] = useState(needsSetup ? 'setup' : 'login'); // 'setup', 'login', 'forgot'
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [enablePin, setEnablePin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [lockInfo, setLockInfo] = useState(null);
  const [attemptsInfo, setAttemptsInfo] = useState(null);

  // Forgot PIN states
  const [showForgotDialog, setShowForgotDialog] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [wipeData, setWipeData] = useState(false);

  useEffect(() => {
    if (mode === 'login') {
      checkLockStatus();
      loadAttemptsInfo();
    }
  }, [mode]);

  const checkLockStatus = async () => {
    try {
      const lockStatus = await LocalAuth.isLocked();
      setLockInfo(lockStatus);
    } catch (error) {
      console.error('Error checking lock status:', error);
    }
  };

  const loadAttemptsInfo = async () => {
    try {
      const info = await LocalAuth.getFailedAttemptsInfo();
      setAttemptsInfo(info);
    } catch (error) {
      console.error('Error loading attempts info:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === 'setup') {
        if (enablePin) {
          if (pin !== confirmPin) {
            toast.error("PINs do not match");
            setIsLoading(false);
            return;
          }
          await LocalAuth.setUpPin(pin, confirmPin);
          toast.success('PIN set up successfully!');
        } else {
          // Skip PIN setup - create session without PIN
          await LocalAuth.createSession(true);
          toast.success('Welcome to Taskora!');
        }
        onAuthenticated();
      } else if (mode === 'login') {
        await LocalAuth.verifyPin(pin);
        toast.success('Welcome back!');
        onAuthenticated();
      }
    } catch (error) {
      console.error('Auth error:', error);
      toast.error(error.message || 'Authentication failed');
      setPin('');

      if (mode === 'login') {
        await checkLockStatus();
        await loadAttemptsInfo();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPin = async () => {
    setIsLoading(true);

    try {
      if (wipeData) {
        const confirmReset = window.confirm("This will delete ALL your saved data. Are you sure you want to continue?");
        if (!confirmReset) {
          setIsLoading(false);
          return;
        }
      }
      await LocalAuth.resetPin(newPin, confirmNewPin, wipeData);
      toast.success('PIN reset successfully!');
      setShowForgotDialog(false);
      setNewPin('');
      setConfirmNewPin('');
      setWipeData(false);
      onAuthenticated();
    } catch (error) {
      console.error('Reset PIN error:', error);
      toast.error(error.message || 'Failed to reset PIN');
    } finally {
      setIsLoading(false);
    }
  };

  const formatRemainingTime = (ms) => {
    const minutes = Math.ceil(ms / (1000 * 60));
    if (minutes < 60) return `${minutes} minute(s)`;
    const hours = Math.ceil(minutes / 60);
    if (hours < 24) return `${hours} hour(s)`;
    const days = Math.ceil(hours / 24);
    return `${days} day(s)`;
  };

  const isLocked = lockInfo?.locked;

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
              {mode === 'setup' ? 'Welcome! Set up your workspace' : 'Welcome back!'}
            </p>
          </div>
        </div>

        {/* Auth Card */}
        <Card className="glass-card border-0">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center space-x-2">
              {mode === 'setup' ? <Shield className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
              <span>
                {mode === 'setup' ? 'Security Setup' : 'Enter PIN'}
              </span>
            </CardTitle>
            <CardDescription>
              {mode === 'setup'
                ? 'Secure your workspace with an optional PIN'
                : 'Enter your PIN to access your workspace'
              }
            </CardDescription>
          </CardHeader>

          <CardContent>
            {isLocked ? (
              <div className="text-center space-y-4">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                  <h3 className="font-semibold text-red-800">Account Locked</h3>
                  <p className="text-sm text-red-600 mt-1">
                    Too many failed attempts. Please try again in {formatRemainingTime(lockInfo.remainingMs)}.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowForgotDialog(true)}
                  className="w-full"
                >
                  Forgot PIN?
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'setup' && (
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

                {(enablePin || mode === 'login') && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="pin">
                        {mode === 'setup' ? 'Create PIN (4-6 digits)' : 'Enter PIN'}
                      </Label>
                      <div className="relative">
                        <Input
                          id="pin"
                          type={showNewPin ? 'text' : 'password'}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder={mode === 'setup' ? 'Create your PIN' : 'Enter your PIN'}
                          value={pin}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '');
                            if (value.length <= 6) setPin(value);
                          }}
                          className="text-center text-lg tracking-wider pr-10"
                          required={enablePin || mode === 'login'}
                          autoFocus
                          disabled={isLoading}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowNewPin(!showNewPin)}
                        >
                          {showNewPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    {mode === 'setup' && enablePin && (
                      <div className="space-y-2">
                        <div className="relative">
                          <Label htmlFor="confirmPin">Confirm PIN</Label>
                          <Input
                            id="confirmPin"
                            type={showConfirmPin ? 'text' : 'password'}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="Confirm your PIN"
                            value={confirmPin}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '');
                              if (value.length <= 6) setConfirmPin(value);
                            }}
                            className="text-center text-lg tracking-wider"
                            required
                            disabled={isLoading}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => setShowConfirmPin(!showConfirmPin)}
                          >
                            {showConfirmPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>

                    )}
                  </>
                )}

                {mode === 'login' && attemptsInfo && attemptsInfo.remaining < attemptsInfo.maxAttempts && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      {attemptsInfo.remaining} attempt(s) remaining before lockout
                    </p>
                  </div>
                )}

                <div className="space-y-2 pt-2">
                  <Button
                    type="submit"
                    className="w-full gradient-bg text-white hover:opacity-90"
                    disabled={isLoading || (enablePin && mode === 'setup' && (!pin || !confirmPin))}
                  >
                    {isLoading ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Processing...</span>
                      </div>
                    ) : (
                      <span>
                        {mode === 'setup'
                          ? (enablePin ? 'Set Up PIN' : 'Get Started')
                          : 'Unlock Workspace'
                        }
                      </span>
                    )}
                  </Button>

                  {mode === 'login' && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowForgotDialog(true)}
                      disabled={isLoading}
                    >
                      Forgot PIN?
                    </Button>
                  )}

                  {mode === 'setup' && !enablePin && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={async () => {
                        try {
                          await LocalAuth.createSession(true);
                          onAuthenticated();
                        } catch (error) {
                          console.error('Skip PIN error:', error);
                        }
                      }}
                      disabled={isLoading}
                    >
                      Skip PIN Setup
                    </Button>
                  )}
                </div>
              </form>
            )}

            {mode === 'login' && (
              <div className="mt-4 text-center">
                <p className="text-sm text-muted-foreground">
                  All your data is stored locally and private
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Features Preview */}
        {mode === 'setup' && (
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

      {/* Forgot PIN Dialog */}
      <Dialog open={showForgotDialog} onOpenChange={setShowForgotDialog}>
        <DialogContent className="glass-card border-0">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <span>Reset PIN</span>
            </DialogTitle>
            <DialogDescription className="space-y-2">
              <p>
                <strong>Warning:</strong> Resetting your PIN will allow anyone with access to this device to set a new PIN.
              </p>
              <p>
                If you have exported encrypted backups, you will need the old PIN to decrypt them.
              </p>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPin">New PIN (4-6 digits)</Label>
              <Input
                id="newPin"
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Enter new PIN"
                value={newPin}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  if (value.length <= 6) setNewPin(value);
                }}
                className="text-center text-lg tracking-wider"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmNewPin">Confirm New PIN</Label>
              <Input
                id="confirmNewPin"
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Confirm new PIN"
                value={confirmNewPin}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  if (value.length <= 6) setConfirmNewPin(value);
                }}
                className="text-center text-lg tracking-wider"
                required
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <Checkbox
                id="wipeData"
                checked={wipeData}
                onCheckedChange={setWipeData}
                disabled={isLoading}
              />
              <Label htmlFor="wipeData" className="text-sm">
                <span className="font-medium text-red-700">Reset PIN and wipe all local data</span>
                <br />
                <span className="text-red-600">This will permanently delete all projects, tasks, and settings</span>
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowForgotDialog(false);
                setNewPin('');
                setConfirmNewPin('');
                setWipeData(false);
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleForgotPin}
              disabled={isLoading || !newPin || !confirmNewPin}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Resetting...</span>
                </div>
              ) : (
                'Reset PIN'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
