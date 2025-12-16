'use client';

import { useState, useEffect } from 'react';
import { dbOperations } from '../lib/database';
import { ThemeManager, LocalAuth } from '../lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Plus, RefreshCcw, Settings, LogOut, Calendar, Clock, CheckCircle, AlertTriangle, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import ProjectManager from './ProjectManager';
import KanbanBoard from './KanbanBoard';
import SettingsPanel from './SettingsPanel';
import TimeTracker from './TimeTracker';

export default function Dashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [analytics, setAnalytics] = useState({});
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);

      const [analyticsData, projectsData, tasksData] = await Promise.all([
        dbOperations.getAnalytics(),
        dbOperations.getProjects(),
        dbOperations.getTasks()
      ]);

      setAnalytics(analyticsData);
      setProjects(projectsData);
      setTasks(tasksData);

      // Generate recent activity
      const activity = [
        ...projectsData.slice(0, 3).map(p => ({
          type: 'project',
          title: `Project: ${p.name}`,
          time: new Date(p.updated_at).toLocaleDateString(),
          status: p.status
        })),
        ...tasksData.slice(0, 5).map(t => ({
          type: 'task',
          title: `Task: ${t.title}`,
          time: new Date(t.updated_at).toLocaleDateString(),
          status: t.status
        }))
      ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 6);

      setRecentActivity(activity);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const rawTaskStatusData = [
    { name: 'To Do', value: tasks.filter(t => t.status === 'todo').length },
    { name: 'In Progress', value: tasks.filter(t => t.status === 'in-progress').length },
    { name: 'Done', value: tasks.filter(t => t.status === 'done').length }
  ];

  // ✅ remove zero-value slices (prevents overlap bugs)
  const chartData = rawTaskStatusData.filter(item => item.value > 0);

  const projectStatusData = [
    { name: 'Active', value: projects.filter(p => p.status === 'active').length },
    { name: 'Completed', value: projects.filter(p => p.status === 'completed').length },
    { name: 'On Hold', value: projects.filter(p => p.status === 'on-hold').length }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-card rounded-xl p-8">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-lg font-medium">Loading Dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="glass border-b p-4 sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 gradient-bg rounded-lg flex items-center justify-center text-white font-bold text-lg">
              T
            </div>
            <div>
              <h1 className="text-2xl font-bold">Taskora</h1>
              <p className="text-sm text-muted-foreground">Project Management Dashboard</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.location.reload()}
              className="glass-card"
            >
              <RefreshCcw className="h-4 w-4" />
            </Button>
                
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActiveTab('settings')}
              className="glass-card"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onLogout}
              className="glass-card"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="glass-card w-full justify-start">
            <TabsTrigger value="overview" className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="projects" className="flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>Projects</span>
            </TabsTrigger>
            <TabsTrigger value="kanban" className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4" />
              <span>Kanban</span>
            </TabsTrigger>
            <TabsTrigger value="timetracker" className="flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>Time Tracker</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="glass-card border-0">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
                  <Calendar className="h-4 w-4 text-emerald-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-600">{analytics.activeProjects || 0}</div>
                  <p className="text-xs text-muted-foreground">Currently in progress</p>
                </CardContent>
              </Card>

              <Card className="glass-card border-0">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completed Tasks</CardTitle>
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{analytics.completedTasks || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {analytics.completionRate || 0}% completion rate
                  </p>
                </CardContent>
              </Card>

              <Card className="glass-card border-0">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Hours Worked</CardTitle>
                  <Clock className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">{analytics.totalHours || 0}h</div>
                  <p className="text-xs text-muted-foreground">Total time tracked</p>
                </CardContent>
              </Card>

              <Card className="glass-card border-0">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{analytics.overdueTasks || 0}</div>
                  <p className="text-xs text-muted-foreground">Need attention</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* --- Billable vs Non-billable Hours as Horizontal Bar --- */}
              <Card className="glass-card border-0">
                <CardHeader>
                  <CardTitle>Billable vs Non-billable Hours</CardTitle>
                  <CardDescription>Time tracking breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart
                      data={analytics.hoursData || []}
                      layout="vertical" // 🔹 horizontal bars
                      margin={{ left: 40 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" />
                      <Tooltip formatter={(value) => `${value}h`} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {(analytics.hoursData || []).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={`var(--accent-${(index % 4) + 1})`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* --- Task Status Donut Chart --- */}
              <Card className="glass-card border-0">
                <CardHeader>
                  <CardTitle>Task Status Distribution</CardTitle>
                  <CardDescription>Overview of all tasks by status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col md:flex-row items-center gap-6">

                    {/* Donut */}
                    <ResponsiveContainer width="60%" height={220}>
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                          dataKey="value"
                          isAnimationActive={false} // ✅ avoids jitter
                        >
                          {chartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={`var(--accent-${(index % 4) + 1})`} />                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>

                    {/* Legend */}
                    <div className="space-y-3 text-sm">
                      {chartData.map(item => (
                        <div key={item.name} className="flex items-center gap-3">
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: `var(--accent-${index + 1})` }}
                          />
                          <span className="font-medium">{item.name}</span>
                          <span className="text-muted-foreground">({item.value})</span>
                        </div>
                      ))}
                    </div>

                  </div>
                </CardContent>
              </Card>

              {/* --- Project Status Vertical Bar --- */}
              <Card className="glass-card border-0">
                <CardHeader>
                  <CardTitle>Project Status</CardTitle>
                  <CardDescription>Active vs completed projects</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={projectStatusData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {projectStatusData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={`var(--accent-${(index % 4) + 1})`} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card className="glass-card border-0">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest updates in your projects and tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivity.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No recent activity</p>
                  ) : (
                    recentActivity.map((activity, index) => (
                      <div key={index} className="flex items-center justify-between p-3 glass rounded-lg">
                        <div className="flex items-center space-x-3">
                          {activity.type === 'project' ? (
                            <Calendar className="h-4 w-4 text-blue-500" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                          <div>
                            <p className="font-medium">{activity.title}</p>
                            <p className="text-sm text-muted-foreground">{activity.time}</p>
                          </div>
                        </div>
                        <Badge variant={activity.status === 'done' ? 'default' : 'secondary'}>
                          {activity.status}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects">
            <ProjectManager onUpdate={loadDashboardData} />
          </TabsContent>

          {/* Kanban Tab */}
          <TabsContent value="kanban">
            <KanbanBoard onUpdate={loadDashboardData} />
          </TabsContent>

          {/* Time Tracker Tab */}
          <TabsContent value="timetracker">
            <TimeTracker onUpdate={loadDashboardData} />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <SettingsPanel />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
