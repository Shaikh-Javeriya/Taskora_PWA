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
import { Progress } from '@/components/ui/progress';
import { Calendar, Plus, Edit, Trash2, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function ProjectManager({ onUpdate }) {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: 'blue',
    deadline: ''
  });

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setIsLoading(true);
      const projectsData = await dbOperations.getProjects();

      // Enhance projects with task statistics
      const enhancedProjects = await Promise.all(
        projectsData.map(async (project) => {
          const tasks = await dbOperations.getTasks(project.id);
          const completedTasks = tasks.filter(t => t.status === 'done').length;
          const totalTasks = tasks.length;
          const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

          return {
            ...project,
            taskCount: totalTasks,
            completedTasks,
            progress
          };
        })
      );

      setProjects(enhancedProjects);
    } catch (error) {
      console.error('Error loading projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Project name is required');
      return;
    }

    try {
      const projectData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        color: formData.color,
        deadline: formData.deadline ? new Date(formData.deadline) : null
      };

      if (editingProject) {
        await dbOperations.updateProject(editingProject.id, projectData);
        toast.success('Project updated successfully!');
      } else {
        await dbOperations.createProject(projectData);
        toast.success('Project created successfully!');
      }

      setIsDialogOpen(false);
      setEditingProject(null);
      setFormData({ name: '', description: '', color: 'blue', deadline: '' });
      await loadProjects();
      onUpdate?.();
    } catch (error) {
      console.error('Error saving project:', error);
      toast.error('Failed to save project');
    }
  };

  const handleEdit = (project) => {
    setEditingProject(project);
    setFormData({
      name: project.name,
      description: project.description || '',
      color: project.color || 'blue',
      deadline: project.deadline ? new Date(project.deadline).toISOString().split('T')[0] : ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (projectId) => {
    if (!confirm('Are you sure you want to delete this project? This will also delete all associated tasks.')) {
      return;
    }

    try {
      await dbOperations.deleteProject(projectId);
      toast.success('Project deleted successfully');
      await loadProjects();
      onUpdate?.();
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project');
    }
  };

  const getStatusIcon = (project) => {
    if (project.progress === 100) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else if (project.deadline && new Date(project.deadline) < new Date()) {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    } else {
      return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusBadge = (project) => {
    if (project.progress === 100) {
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Completed</Badge>;
    } else if (project.deadline && new Date(project.deadline) < new Date()) {
      return <Badge variant="destructive">Overdue</Badge>;
    } else {
      return <Badge variant="secondary">Active</Badge>;
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Projects</h2>
          <p className="text-muted-foreground">Manage your projects and track progress</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-bg text-white hover:opacity-90">
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </DialogTrigger>

          <DialogContent className="glass-card border-0">
            <DialogHeader>
              <DialogTitle>
                {editingProject ? 'Edit Project' : 'Create New Project'}
              </DialogTitle>
              <DialogDescription>
                {editingProject
                  ? 'Update your project details'
                  : 'Add a new project to your workspace'
                }
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Project Name *</Label>
                <Input
                  id="name"
                  placeholder="Enter project name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Project description (optional)"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="color">Color Theme</Label>
                  <Select value={formData.color} onValueChange={(value) => setFormData({ ...formData, color: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blue">Blue</SelectItem>
                      <SelectItem value="green">Green</SelectItem>
                      <SelectItem value="purple">Purple</SelectItem>
                      <SelectItem value="teal">Teal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deadline">Deadline</Label>
                  <Input
                    id="deadline"
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  setIsDialogOpen(false);
                  setEditingProject(null);
                  setFormData({ name: '', description: '', color: 'blue', deadline: '' });
                }}>
                  Cancel
                </Button>
                <Button type="submit" className="gradient-bg text-white hover:opacity-90">
                  {editingProject ? 'Update Project' : 'Create Project'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No projects yet</h3>
            <p className="text-muted-foreground mb-4">Create your first project to get started</p>
            <Button
              onClick={() => setIsDialogOpen(true)}
              className="gradient-bg text-white hover:opacity-90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Project
            </Button>
          </div>
        ) : (
          projects.map((project) => (
            <Card key={project.id} className="glass-card border-0 hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(project)}
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(project)}
                      className="h-8 w-8"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(project.id)}
                      className="h-8 w-8 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {project.description && (
                  <CardDescription className="text-sm">
                    {project.description}
                  </CardDescription>
                )}
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  {getStatusBadge(project)}
                  <span className="text-sm text-muted-foreground">
                    {project.completedTasks}/{project.taskCount} tasks
                  </span>
                </div>

                <div className="text-xs text-muted-foreground">
                  Project ID: <span className="font-mono">{project.id}</span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Progress</span>
                    <span className="font-medium">{project.progress}%</span>
                  </div>
                  <Progress value={project.progress} className="h-2" />
                </div>

                {project.deadline && (
                  <div className="text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 inline mr-1" />
                    Due: {new Date(project.deadline).toLocaleDateString()}
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  Updated: {new Date(project.updated_at).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
