'use client';

import { useState, useEffect } from 'react';
import { dbOperations } from '../lib/database';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Play, Square, Clock, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function TimeTracker({ taskId = null, projectId = null, compact = false }) {
  const [activeTimer, setActiveTimer] = useState(null);
  const [timeEntries, setTimeEntries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);
  const [logForm, setLogForm] = useState({
    task_id: taskId || '',
    project_id: projectId || '',
    duration: '',
    description: '',
    billable: true,
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadData();
  }, [taskId, projectId]);

  useEffect(() => {
    let interval;
    if (activeTimer) {
      interval = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now - new Date(activeTimer.start_time)) / 1000); // seconds
        setElapsedTime(elapsed);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeTimer]);

  const loadData = async () => {
    try {
      const [projectsData, tasksData, entriesData] = await Promise.all([
        dbOperations.getProjects(),
        taskId ? [await dbOperations.getTask(taskId)] : dbOperations.getTasks(projectId),
        dbOperations.getTimeEntries(taskId, projectId)
      ]);

      setProjects(projectsData);
      setTasks(tasksData.filter(Boolean));
      setTimeEntries(entriesData);

      const active = entriesData.find(entry => !entry.end_time);
      setActiveTimer(active);
      if (active) {
        const elapsed = Math.floor((new Date() - new Date(active.start_time)) / 1000);
        setElapsedTime(elapsed);
      }
    } catch (error) {
      console.error('Error loading time tracker data:', error);
    }
  };

  const startTimer = async (selectedTaskId = null) => {
    try {
      const targetTaskId = selectedTaskId || taskId;
      const targetProjectId = projectId;

      if (!targetTaskId && !targetProjectId) {
        toast.error('Please select a task or project to track time');
        return;
      }

      if (activeTimer) {
        await stopTimer();
      }

      const timeEntry = {
        task_id: targetTaskId,
        project_id: targetProjectId || (targetTaskId ? tasks.find(t => t.id === targetTaskId)?.project_id : null),
        start_time: new Date(),
        description: '',
        billable: true
      };

      const entryId = await dbOperations.createTimeEntry(timeEntry);
      const newEntry = { ...timeEntry, id: entryId };

      setActiveTimer(newEntry);
      setElapsedTime(0);
      toast.success('Timer started!');

      await loadData();
    } catch (error) {
      console.error('Error starting timer:', error);
      toast.error('Failed to start timer');
    }
  };

  const stopTimer = async () => {
    try {
      if (!activeTimer) return;

      const endTime = new Date();
      const durationSeconds = Math.floor((endTime - new Date(activeTimer.start_time)) / 1000);
      const durationHours = Math.round((durationSeconds / 3600) * 100) / 100;

      await dbOperations.updateTimeEntry(activeTimer.id, {
        end_time: endTime,
        duration: durationHours
      });

      setActiveTimer(null);
      setElapsedTime(0);
      toast.success(`Timer stopped! Logged ${durationHours} hours`);

      await loadData();
    } catch (error) {
      console.error('Error stopping timer:', error);
      toast.error('Failed to stop timer');
    }
  };

  const logManualTime = async () => {
    try {
      if (!logForm.duration || !logForm.task_id) {
        toast.error('Please fill in task and duration');
        return;
      }

      const durationValue = parseFloat(logForm.duration);
      if (isNaN(durationValue) || durationValue <= 0) {
        toast.error('Please enter a valid duration');
        return;
      }

      const timeEntry = {
        task_id: parseInt(logForm.task_id),
        project_id: parseInt(logForm.project_id) || tasks.find(t => t.id === parseInt(logForm.task_id))?.project_id,
        start_time: new Date(`${logForm.date}T09:00:00`),
        end_time: new Date(`${logForm.date}T${String(9 + Math.floor(durationValue)).padStart(2, '0')}:${String((durationValue % 1) * 60).padStart(2, '0')}:00`),
        duration: durationValue,
        description: logForm.description.trim(),
        billable: logForm.billable
      };

      await dbOperations.createTimeEntry(timeEntry);

      setIsLogDialogOpen(false);
      setLogForm({
        task_id: taskId || '',
        project_id: projectId || '',
        duration: '',
        description: '',
        billable: true,
        date: new Date().toISOString().split('T')[0]
      });

      toast.success(`Logged ${durationValue} hours successfully!`);
      await loadData();
    } catch (error) {
      console.error('Error logging time:', error);
      toast.error('Failed to log time');
    }
  };

  const deleteTimeEntry = async (entryId) => {
    if (!confirm('Are you sure you want to delete this time entry?')) {
      return;
    }

    try {
      await dbOperations.deleteTimeEntry(entryId);
      toast.success('Time entry deleted');
      await loadData();
    } catch (error) {
      console.error('Error deleting time entry:', error);
      toast.error('Failed to delete time entry');
    }
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatDuration = (hours) => {
    return `${Math.round(hours * 100) / 100}h`;
  };

  const getTaskName = (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    return task ? task.title : 'Unknown Task';
  };

  const getProjectName = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    return project ? project.name : 'Unknown Project';
  };

  // --- rest of your JSX UI (unchanged) ---
  if (compact) {
    // Compact version for Kanban cards
    return (
      <div className="flex items-center space-x-2 mt-2">
        {activeTimer && activeTimer.task_id === taskId ? (
          <>
            <Button
              size="sm"
              variant="destructive"
              onClick={stopTimer}
              className="h-6 px-2"
            >
              <Square className="h-3 w-3 mr-1" />
              {formatTime(elapsedTime)}
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => startTimer(taskId)}
            className="h-6 px-2"
            disabled={!taskId}
          >
            <Play className="h-3 w-3 mr-1" />
            Start
          </Button>
        )}

        <Dialog open={isLogDialogOpen} onOpenChange={setIsLogDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost" className="h-6 px-1">
              <Plus className="h-3 w-3" />
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card border-0">
            <DialogHeader>
              <DialogTitle>Log Time Manually</DialogTitle>
              <DialogDescription>
                Add time entry for completed work
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Duration (hours)</Label>
                <Input
                  type="number"
                  step="0.25"
                  placeholder="e.g. 2.5"
                  value={logForm.duration}
                  onChange={(e) => setLogForm({ ...logForm, duration: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="What did you work on?"
                  value={logForm.description}
                  onChange={(e) => setLogForm({ ...logForm, description: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={logForm.billable}
                  onCheckedChange={(checked) => setLogForm({ ...logForm, billable: checked })}
                />
                <Label>Billable</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsLogDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={logManualTime} className="gradient-bg text-white hover:opacity-90">
                Log Time
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Full time tracker interface
  return (
    <div className="space-y-6">
      {/* Active Timer Display */}
      {activeTimer && (
        <Card className="glass-card border-0 border-l-4 border-l-blue-500">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <div>
                  <p className="font-medium">{getTaskName(activeTimer.task_id) || getProjectName(activeTimer.project_id)}</p>
                  <p className="text-sm text-muted-foreground">{getProjectName(activeTimer.project_id)}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="secondary" className="text-lg font-mono">
                  {formatTime(elapsedTime)}
                </Badge>
                <Button onClick={stopTimer} variant="destructive" size="sm">
                  <Square className="h-4 w-4 mr-1" />
                  Stop
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timer Controls */}
      <Card className="glass-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Time Tracker</span>
          </CardTitle>
          <CardDescription>
            Track time for your tasks and projects
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!activeTimer && (
            <div className="flex items-center space-x-2">
              <Select value={logForm.task_id} onValueChange={(value) => setLogForm({ ...logForm, task_id: value })}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select task to track..." />
                </SelectTrigger>
                <SelectContent>
                  {tasks.map(task => (
                    <SelectItem key={task.id} value={task.id.toString()}>
                      {task.title} - {getProjectName(task.project_id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                onClick={() => startTimer(parseInt(logForm.task_id))}
                disabled={!logForm.task_id}
                className="gradient-bg text-white hover:opacity-90"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Timer
              </Button>
            </div>
          )}

          <div className="flex space-x-2">
            <Dialog open={isLogDialogOpen} onOpenChange={setIsLogDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex-1">
                  <Plus className="h-4 w-4 mr-2" />
                  Log Time Manually
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card border-0">
                <DialogHeader>
                  <DialogTitle>Log Time Manually</DialogTitle>
                  <DialogDescription>
                    Add time entry for completed work
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Task</Label>
                    <Select value={logForm.task_id} onValueChange={(value) => setLogForm({ ...logForm, task_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select task" />
                      </SelectTrigger>
                      <SelectContent>
                        {tasks.map(task => (
                          <SelectItem key={task.id} value={task.id.toString()}>
                            {task.title} - {getProjectName(task.project_id)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Duration (hours)</Label>
                      <Input
                        type="number"
                        step="0.25"
                        placeholder="e.g. 2.5"
                        value={logForm.duration}
                        onChange={(e) => setLogForm({ ...logForm, duration: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={logForm.date}
                        onChange={(e) => setLogForm({ ...logForm, date: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      placeholder="What did you work on?"
                      value={logForm.description}
                      onChange={(e) => setLogForm({ ...logForm, description: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={logForm.billable}
                      onCheckedChange={(checked) => setLogForm({ ...logForm, billable: checked })}
                    />
                    <Label>Billable time</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsLogDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={logManualTime} className="gradient-bg text-white hover:opacity-90">
                    Log Time
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Recent Time Entries */}
      <Card className="glass-card border-0">
        <CardHeader>
          <CardTitle>Recent Time Entries</CardTitle>
          <CardDescription>Your logged hours and active sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {timeEntries.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No time entries yet</p>
            ) : (
              timeEntries.slice(0, 10).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-3 glass rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{getTaskName(entry.task_id) || getProjectName(entry.project_id)}</p>
                      <p className="text-sm text-muted-foreground">
                        {entry.description || 'No description'}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {new Date(entry.start_time).toLocaleDateString()}
                        </span>
                        {entry.billable && (
                          <Badge variant="outline" className="text-xs">Billable</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary">
                      {entry.duration ? formatDuration(entry.duration) : 'Active'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteTimeEntry(entry.id)}
                      className="h-8 w-8 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
