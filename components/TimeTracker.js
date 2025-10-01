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
}
