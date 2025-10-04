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
import { Plus, Edit, Trash2, Calendar, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import TimeTracker from './TimeTracker';

const STATUSES = [
  { id: 'todo', label: 'To Do', color: 'bg-gray-100 border-gray-300' },
  { id: 'in-progress', label: 'In Progress', color: 'bg-blue-100 border-blue-300' },
  { id: 'done', label: 'Done', color: 'bg-green-100 border-green-300' }
];

const PRIORITIES = [
  { id: 'low', label: 'Low', color: 'bg-green-500' },
  { id: 'medium', label: 'Medium', color: 'bg-yellow-500' },
  { id: 'high', label: 'High', color: 'bg-red-500' }
];

export default function KanbanBoard({ onUpdate }) {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedProject, setSelectedProject] = useState('all');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    project_id: '',
    priority: 'medium',
    status: 'todo',
    deadline: '',
    estimated_hours: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const reload = () => loadData();
    window.addEventListener("dataUpdated", reload);
    return () => window.removeEventListener("dataUpdated", reload);
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [tasksData, projectsData] = await Promise.all([
        dbOperations.getTasks(),
        dbOperations.getProjects()
      ]);
      console.log("Loaded tasks:", tasksData);
      setProjects(projectsData);
      setTasks(tasksData);

    } catch (error) {
      console.error('Error loading kanban data:', error);
      toast.error('Failed to load kanban board');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error('Task title is required');
      return;
    }

    if (!formData.project_id) {
      toast.error('Please select a project');
      return;
    }

    try {
      const taskData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        project_id: parseInt(formData.project_id),
        priority: formData.priority,
        status: formData.status,
        deadline: formData.deadline ? new Date(formData.deadline) : null,
        estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null
      };

      if (editingTask) {
        await dbOperations.updateTask(editingTask.id, taskData);
        toast.success('Task updated successfully!');
      } else {
        await dbOperations.createTask(taskData);
        toast.success('Task created successfully!');
      }

      setIsDialogOpen(false);
      setEditingTask(null);
      resetForm();
      await loadData();
      onUpdate?.();
    } catch (error) {
      console.error('Error saving task:', error);
      toast.error('Failed to save task');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      project_id: '',
      priority: 'medium',
      status: 'todo',
      deadline: '',
      estimated_hours: ''
    });
  };

  const handleEdit = (task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      project_id: task.project_id.toString(),
      priority: task.priority,
      status: task.status,
      deadline: task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : '',
      estimated_hours: task.estimated_hours ? task.estimated_hours.toString() : ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (taskId) => {
    if (!confirm('Are you sure you want to delete this task?')) {
      return;
    }

    try {
      await dbOperations.deleteTask(taskId);
      toast.success('Task deleted successfully');
      await loadData();
      onUpdate?.();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await dbOperations.updateTask(taskId, { status: newStatus });
      await loadData();
      onUpdate?.();
    } catch (error) {
      console.error('Error updating task status:', error);
      toast.error('Failed to update task status');
    }
  };

  const getFilteredTasks = () => {
    if (selectedProject === 'all') return tasks;
    return tasks.filter(task => String(task.project_id) === String(selectedProject));
  };

  const normalizeStatus = (s) => {
    if (!s) return "todo";
    const v = String(s).toLowerCase().trim();
    if (v === "todo" || v === "to do" || v === "to-do") return "todo";
    if (v.includes("in") && v.includes("progress") || v === "in-progress" || v === "in progress") return "in-progress";
    if (v === "done" || v === "complete" || v === "completed") return "done";
    return "todo";
  };

  const getTasksByStatus = (status) => {
    return getFilteredTasks().filter(task => normalizeStatus(task.status) === status);
  };

  const getProjectName = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    return project ? project.name : 'Unknown Project';
  };

  const getPriorityColor = (priority) => {
    const priorityData = PRIORITIES.find(p => p.id === priority);
    return priorityData ? priorityData.color : 'bg-gray-500';
  };

  const isOverdue = (task) => {
    return task.deadline && new Date(task.deadline) < new Date() && task.status !== 'done';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-2xl font-bold">Kanban Board</h2>
          <p className="text-muted-foreground">Manage tasks across different stages</p>
        </div>

        <div className="flex items-center space-x-2">
          <Select
            value={selectedProject?.toString() ?? "all"}
            onValueChange={(val) =>
              val === "all" ? setSelectedProject("all") : setSelectedProject(Number(val))
            }
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id.toString()}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-bg text-white hover:opacity-90">
                <Plus className="h-4 w-4 mr-2" />
                New Task
              </Button>
            </DialogTrigger>

            <DialogContent className="glass-card border-0 max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingTask ? 'Edit Task' : 'Create New Task'}
                </DialogTitle>
                <DialogDescription>
                  {editingTask
                    ? 'Update your task details'
                    : 'Add a new task to your project'
                  }
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Task Title *</Label>
                  <Input
                    id="title"
                    placeholder="Enter task title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Task description (optional)"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project">Project *</Label>
                  <Select value={formData.project_id} onValueChange={(value) => setFormData({ ...formData, project_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map(project => (
                        <SelectItem key={project.id} value={project.id.toString()}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map(priority => (
                          <SelectItem key={priority.id} value={priority.id}>
                            {priority.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map(status => (
                          <SelectItem key={status.id} value={status.id}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="deadline">Deadline</Label>
                    <Input
                      id="deadline"
                      type="date"
                      value={formData.deadline}
                      onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="estimated_hours">Est. Hours</Label>
                    <Input
                      id="estimated_hours"
                      type="number"
                      step="0.5"
                      placeholder="0"
                      value={formData.estimated_hours}
                      onChange={(e) => setFormData({ ...formData, estimated_hours: e.target.value })}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => {
                    setIsDialogOpen(false);
                    setEditingTask(null);
                    resetForm();
                  }}>
                    Cancel
                  </Button>
                  <Button type="submit" className="gradient-bg text-white hover:opacity-90">
                    {editingTask ? 'Update Task' : 'Create Task'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {STATUSES.map((status) => {
          const columnTasks = getTasksByStatus(status.id);

          return (
            <div key={status.id} className="space-y-4">
              {/* Column Header */}
              <div className={`glass-card border-0 p-4 ${status.color}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{status.label}</h3>
                  <Badge variant="secondary">{columnTasks.length}</Badge>
                </div>
              </div>

              {/* Tasks */}
              <div className="space-y-3 min-h-[400px]">
                {columnTasks.length === 0 ? (
                  <div className="glass rounded-lg p-6 text-center text-muted-foreground">
                    <p>No tasks in {status.label.toLowerCase()}</p>
                  </div>
                ) : (
                  columnTasks.map((task) => (
                    <Card key={task.id} className={`glass-card border-0 hover:shadow-lg transition-shadow cursor-pointer ${isOverdue(task) ? 'border-l-4 border-l-red-500' : ''
                      }`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-sm font-medium">{task.title}</CardTitle>
                          <div className="flex items-center space-x-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(task)}
                              className="h-6 w-6"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(task.id)}
                              className="h-6 w-6 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        {task.description && (
                          <CardDescription className="text-xs">
                            {task.description}
                          </CardDescription>
                        )}
                      </CardHeader>

                      <CardContent className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            {getProjectName(task.project_id)}
                          </Badge>
                          <div className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`}></div>
                        </div>

                        {task.deadline && (
                          <div className={`flex items-center text-xs ${isOverdue(task) ? 'text-red-600' : 'text-muted-foreground'
                            }`}>
                            {isOverdue(task) ? (
                              <AlertTriangle className="h-3 w-3 mr-1" />
                            ) : (
                              <Calendar className="h-3 w-3 mr-1" />
                            )}
                            {new Date(task.deadline).toLocaleDateString()}
                          </div>
                        )}

                        {task.estimated_hours && (
                          <div className="flex items-center text-xs text-muted-foreground">
                            <Clock className="h-3 w-3 mr-1" />
                            {task.estimated_hours}h estimated
                          </div>
                        )}

                        {/* Time Tracker */}
                        <TimeTracker taskId={task.id} compact={true} />

                        {/* Status Change Buttons */}
                        <div className="flex space-x-1 pt-2">
                          {STATUSES.filter(s => s.id !== task.status).map((targetStatus) => (
                            <Button
                              key={targetStatus.id}
                              variant="outline"
                              size="sm"
                              className="text-xs px-2 py-1 h-6"
                              onClick={() => handleStatusChange(task.id, targetStatus.id)}
                            >
                              Move to {targetStatus.label}
                            </Button>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
