'use client';

import { useState, useEffect } from 'react';
import { dbOperations } from '../lib/database';
import { LocalAuth, ThemeManager } from '../lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Palette, Shield, Download, Upload, Trash2, Database, Info, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { exportCSV, exportJSON, importCSV, importJSON } from "../lib/utils";

export default function SettingsPanel() {
  const [settings, setSettings] = useState({
    theme: 'blue',
    user_name: 'User',
    pin_enabled: false,
    notifications_enabled: false,
    deadline_notifications: true,
    overdue_notifications: true
  });
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  useEffect(() => {
    loadSettings();
    loadStats();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const [theme, userName, pinEnabled, notificationsEnabled, deadlineNotifications, overdueNotifications] = await Promise.all([
        dbOperations.getSetting('theme'),
        dbOperations.getSetting('user_name'),
        LocalAuth.isSetUp(),
        dbOperations.getSetting('notifications_enabled'),
        dbOperations.getSetting('deadline_notifications'),
        dbOperations.getSetting('overdue_notifications')
      ]);

      setSettings({
        theme: theme || 'blue',
        user_name: userName || 'User',
        pin_enabled: pinEnabled,
        notifications_enabled: notificationsEnabled !== false,
        deadline_notifications: deadlineNotifications !== false,
        overdue_notifications: overdueNotifications !== false
      });
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const [projects, tasks, timeEntries] = await Promise.all([
        dbOperations.getProjects(),
        dbOperations.getTasks(),
        dbOperations.getTimeEntries()
      ]);

      setStats({
        projects: projects.length,
        tasks: tasks.length,
        timeEntries: timeEntries.length,
        storageSize: await getStorageSize()
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const getStorageSize = async () => {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const used = estimate.usage || 0;
        return (used / 1024 / 1024).toFixed(2); // MB
      }
    } catch (error) {
      console.error('Error getting storage size:', error);
    }
    return 'Unknown';
  };

  const handleThemeChange = async (theme) => {
    try {
      await ThemeManager.setTheme(theme);
      setSettings(prev => ({ ...prev, theme }));
      toast.success('Theme updated successfully!');
    } catch (error) {
      console.error('Error updating theme:', error);
      toast.error('Failed to update theme');
    }
  };

  const handleUserNameChange = async (userName) => {
    try {
      await dbOperations.setSetting('user_name', userName);
      setSettings(prev => ({ ...prev, user_name: userName }));
      toast.success('Name updated successfully!');
    } catch (error) {
      console.error('Error updating user name:', error);
      toast.error('Failed to update name');
    }
  };

  const handlePinSetup = async () => {
    try {
      if (isChangingPin) {
        // Change existing PIN
        await LocalAuth.changePin(oldPin, newPin, confirmPin);
        toast.success('PIN changed successfully!');
      } else {
        // Setup new PIN
        await LocalAuth.setUpPin(newPin, confirmPin);
        toast.success('PIN setup successfully!');
      }

      setSettings(prev => ({ ...prev, pin_enabled: true }));
      setIsPinDialogOpen(false);
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
      setIsChangingPin(false);
    } catch (error) {
      console.error('Error with PIN:', error);
      toast.error(error.message || 'PIN operation failed');
    }
  };

  const handleDisablePin = async () => {
    if (!confirm('Are you sure you want to disable PIN protection? You will need to enter your current PIN.')) {
      return;
    }

    const currentPin = prompt('Enter your current PIN to disable protection:');
    if (!currentPin) return;

    try {
      await LocalAuth.disablePin(currentPin);
      setSettings(prev => ({ ...prev, pin_enabled: false }));
      toast.success('PIN protection disabled');
    } catch (error) {
      console.error('Error disabling PIN:', error);
      toast.error(error.message || 'Failed to disable PIN');
    }
  };

  const clearAllData = async () => {
    if (!confirm('Are you sure you want to delete ALL data? This action cannot be undone.')) {
      return;
    }

    if (!confirm('This will permanently delete all projects, tasks, and time entries. Type "DELETE" to confirm:')) {
      return;
    }

    try {
      const db = await import('../lib/database').then(m => m.default);
      await db.transaction('rw', [db.projects, db.tasks, db.time_entries], async () => {
        await db.projects.clear();
        await db.tasks.clear();
        await db.time_entries.clear();
      });

      toast.success('All data cleared successfully');
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error('Clear data error:', error);
      toast.error('Failed to clear data');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-muted-foreground">Customize your Taskora experience</p>
      </div>

      {/* Appearance */}
      <Card className="glass-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Palette className="h-5 w-5" />
            <span>Appearance</span>
          </CardTitle>
          <CardDescription>
            Customize the look and feel of your workspace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Theme</Label>
            <Select value={settings.theme} onValueChange={handleThemeChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ThemeManager.themes).map(([key, theme]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ background: theme['--gradient'] }}
                      ></div>
                      <span>{theme.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Display Name</Label>
            <Input
              placeholder="Enter your name"
              value={settings.user_name}
              onChange={(e) => handleUserNameChange(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="glass-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Security</span>
          </CardTitle>
          <CardDescription>
            Manage your workspace security settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">PIN Protection</Label>
                <p className="text-sm text-muted-foreground">
                  {settings.pin_enabled
                    ? 'Your workspace is protected with a PIN'
                    : 'Add a PIN to secure your workspace'
                  }
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {settings.pin_enabled ? (
                  <>
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      Enabled
                    </Badge>
                    <Button variant="outline" size="sm" onClick={() => {
                      setIsChangingPin(true);
                      setIsPinDialogOpen(true);
                    }}>
                      Change PIN
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDisablePin}>
                      Disable
                    </Button>
                  </>
                ) : (
                  <>
                    <Badge variant="outline">Disabled</Badge>
                    <Button size="sm" className="gradient-bg text-white hover:opacity-90" onClick={() => {
                      setIsChangingPin(false);
                      setIsPinDialogOpen(true);
                    }}>
                      Setup PIN
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="glass-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5" />
            <span>Notifications</span>
          </CardTitle>
          <CardDescription>
            Manage your notification preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Enable Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Allow Taskora to send push notifications
              </p>
            </div>
            <Switch
              checked={settings.notifications_enabled}
              onCheckedChange={async (checked) => {
                if (checked && window.Notification) {
                  const permission = await Notification.requestPermission();
                  if (permission === 'granted') {
                    await dbOperations.setSetting('notifications_enabled', true);
                    setSettings(prev => ({ ...prev, notifications_enabled: true }));
                    toast.success('Notifications enabled!');
                  } else {
                    toast.error('Notification permission denied');
                  }
                } else {
                  await dbOperations.setSetting('notifications_enabled', false);
                  setSettings(prev => ({ ...prev, notifications_enabled: false }));
                  toast.success('Notifications disabled');
                }
              }}
            />
          </div>

          {settings.notifications_enabled && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Deadline Reminders</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified about upcoming task deadlines
                    </p>
                  </div>
                  <Switch
                    checked={settings.deadline_notifications}
                    onCheckedChange={async (checked) => {
                      await dbOperations.setSetting('deadline_notifications', checked);
                      setSettings(prev => ({ ...prev, deadline_notifications: checked }));
                      toast.success(checked ? 'Deadline reminders enabled' : 'Deadline reminders disabled');
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Overdue Task Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified about overdue tasks
                    </p>
                  </div>
                  <Switch
                    checked={settings.overdue_notifications}
                    onCheckedChange={async (checked) => {
                      await dbOperations.setSetting('overdue_notifications', checked);
                      setSettings(prev => ({ ...prev, overdue_notifications: checked }));
                      toast.success(checked ? 'Overdue alerts enabled' : 'Overdue alerts disabled');
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card className="glass-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="h-5 w-5" />
            <span>Data Management</span>
          </CardTitle>
          <CardDescription>
            Backup, restore, and manage your local data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Data Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 glass rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.projects}</div>
              <div className="text-sm text-muted-foreground">Projects</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.tasks}</div>
              <div className="text-sm text-muted-foreground">Tasks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.timeEntries}</div>
              <div className="text-sm text-muted-foreground">Time Entries</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.storageSize}</div>
              <div className="text-sm text-muted-foreground">MB Used</div>
            </div>
          </div>

          <Separator />

          {/* Backup & Restore */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Export Data</Label>
                <p className="text-sm text-muted-foreground">Download a backup of all your data</p>
              </div>
              <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass-card border-0">
                  <DialogHeader>
                    <DialogTitle>Export Data</DialogTitle>
                    <DialogDescription>
                      This will download a JSON file containing all your projects, tasks, and time entries.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={exportCSV} variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                    <Button onClick={exportJSON} className="gradient-bg text-white hover:opacity-90">
                      <Download className="h-4 w-4 mr-2" />
                      Export JSON (Backup)
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base">Import Data</Label>
                <p className="text-sm text-muted-foreground">Restore from a backup file</p>
              </div>
              <div>
                <input
                  type="file"
                  accept=".json,.csv"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      if (file.name.endsWith('.json')) {
                        await importJSON(file);
                        toast.success('✅ JSON Import complete! Please refresh.');
                      } else if (file.name.endsWith('.csv')) {
                        await importCSV(file);
                        toast.success('✅ CSV Import complete! Please refresh.');
                      }
                      setTimeout(() => window.location.reload(), 1500);
                    } catch (err) {
                      toast.error('❌ Import failed: ' + err.message);
                    }
                    e.target.value = '';
                  }}
                  className="hidden"
                  id="import-file"
                />
                <Button variant="outline" onClick={() => document.getElementById('import-file')?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </Button>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base text-red-600">Clear All Data</Label>
                <p className="text-sm text-muted-foreground">Permanently delete all your data</p>
              </div>
              <Button variant="destructive" onClick={clearAllData}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* App Info */}
      <Card className="glass-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Info className="h-5 w-5" />
            <span>About</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Version:</span>
            <span>1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Storage:</span>
            <span>Local (IndexedDB)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Data Privacy:</span>
            <span className="text-green-600">100% Local</span>
          </div>
          <Separator />
          <p className="text-sm text-muted-foreground">
            Taskora is a local-first PWA. All your data stays on your device and never leaves it.
          </p>
        </CardContent>
      </Card>

      {/* PIN Setup/Change Dialog */}
      <Dialog open={isPinDialogOpen} onOpenChange={setIsPinDialogOpen}>
        <DialogContent className="glass-card border-0">
          <DialogHeader>
            <DialogTitle>
              {isChangingPin ? 'Change PIN' : 'Setup PIN Protection'}
            </DialogTitle>
            <DialogDescription>
              {isChangingPin
                ? 'Enter your current PIN and create a new one'
                : 'Create a PIN to secure your workspace'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {isChangingPin && (
              <div className="space-y-2">
                <Label>Current PIN</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  placeholder="Enter current PIN"
                  value={oldPin}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 6) setOldPin(value);
                  }}
                  className="text-center text-lg tracking-wider"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>New PIN (4-6 digits)</Label>
              <Input
                type="password"
                inputMode="numeric"
                placeholder="Enter new PIN"
                value={newPin}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  if (value.length <= 6) setNewPin(value);
                }}
                className="text-center text-lg tracking-wider"
              />
            </div>

            <div className="space-y-2">
              <Label>Confirm PIN</Label>
              <Input
                type="password"
                inputMode="numeric"
                placeholder="Confirm new PIN"
                value={confirmPin}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  if (value.length <= 6) setConfirmPin(value);
                }}
                className="text-center text-lg tracking-wider"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsPinDialogOpen(false);
              setOldPin('');
              setNewPin('');
              setConfirmPin('');
              setIsChangingPin(false);
            }}>
              Cancel
            </Button>
            <Button
              onClick={handlePinSetup}
              className="gradient-bg text-white hover:opacity-90"
              disabled={!newPin || !confirmPin || (isChangingPin && !oldPin)}
            >
              {isChangingPin ? 'Change PIN' : 'Setup PIN'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
