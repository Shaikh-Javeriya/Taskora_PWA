import Dexie from 'dexie';

// Local database using Dexie.js
class TaskoraDB extends Dexie {
  constructor() {
    super('TaskoraDB');
    
    this.version(1).stores({
      projects: '++id, name, description, color, status, created_at, updated_at, deadline',
      tasks: '++id, project_id, title, description, status, priority, created_at, updated_at, deadline, estimated_hours, actual_hours',
      time_entries: '++id, task_id, project_id, start_time, end_time, duration, description, created_at',
      settings: '++id, key, value',
      auth: 'id, pinHash, salt, iterations, createdAt, failedAttempts, lockoutUntil',
      session: 'id, token, createdAt, expiresAt'
    });
  }
}

// Initialize database
const db = new TaskoraDB();

// Default data initialization
export const initializeDatabase = async () => {
  try {
    // Check if settings exist, if not create default ones
    const settingsCount = await db.settings.count();
    if (settingsCount === 0) {
      await db.settings.bulkAdd([
        { key: 'theme', value: 'blue' },
        { key: 'user_name', value: 'User' },
        { key: 'pin_enabled', value: false },
        { key: 'pin_hash', value: '' },
        { key: 'first_launch', value: true }
      ]);
    }
    
    // Add sample data on first launch
    const projectsCount = await db.projects.count();
    if (projectsCount === 0) {
      const sampleProjectId = await db.projects.add({
        name: 'Welcome to Taskora',
        description: 'Your first project to get started with task management',
        color: 'blue',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      });
      
      await db.tasks.bulkAdd([
        {
          project_id: sampleProjectId,
          title: 'Explore the Dashboard',
          description: 'Take a look at your project overview and KPIs',
          status: 'todo',
          priority: 'medium',
          created_at: new Date(),
          updated_at: new Date(),
          estimated_hours: 0.5
        },
        {
          project_id: sampleProjectId,
          title: 'Create your first task',
          description: 'Add a new task to get familiar with the interface',
          status: 'in-progress',
          priority: 'high',
          created_at: new Date(),
          updated_at: new Date(),
          estimated_hours: 1
        },
        {
          project_id: sampleProjectId,
          title: 'Try the Kanban board',
          description: 'Drag and drop tasks between different columns',
          status: 'done',
          priority: 'low',
          created_at: new Date(),
          updated_at: new Date(),
          estimated_hours: 0.5,
          actual_hours: 0.3
        }
      ]);
    }
  } catch (error) {
    console.error('Database initialization error:', error);
  }
};

// Database operations
export const dbOperations = {
  // Projects
  async getProjects() {
    return await db.projects.orderBy('updated_at').reverse().toArray();
  },
  
  async getProject(id) {
    return await db.projects.get(id);
  },
  
  async createProject(project) {
    const now = new Date();
    return await db.projects.add({
      ...project,
      status: 'active',
      created_at: now,
      updated_at: now
    });
  },
  
  async updateProject(id, updates) {
    return await db.projects.update(id, {
      ...updates,
      updated_at: new Date()
    });
  },
  
  async deleteProject(id) {
    await db.tasks.where('project_id').equals(id).delete();
    await db.time_entries.where('project_id').equals(id).delete();
    return await db.projects.delete(id);
  },
  
  // Tasks
  async getTasks(projectId = null) {
    if (projectId) {
      return await db.tasks.where('project_id').equals(projectId).toArray();
    }
    return await db.tasks.toArray();
  },
  
  async getTask(id) {
    return await db.tasks.get(id);
  },
  
  async createTask(task) {
    const now = new Date();
    return await db.tasks.add({
      ...task,
      status: task.status || 'todo',
      priority: task.priority || 'medium',
      created_at: now,
      updated_at: now
    });
  },
  
  async updateTask(id, updates) {
    return await db.tasks.update(id, {
      ...updates,
      updated_at: new Date()
    });
  },
  
  async deleteTask(id) {
    await db.time_entries.where('task_id').equals(id).delete();
    return await db.tasks.delete(id);
  },
  
  // Time entries
  async getTimeEntries(taskId = null, projectId = null) {
    if (taskId) {
      return await db.time_entries.where('task_id').equals(taskId).toArray();
    }
    if (projectId) {
      return await db.time_entries.where('project_id').equals(projectId).toArray();
    }
    return await db.time_entries.toArray();
  },
  
  async createTimeEntry(entry) {
    return await db.time_entries.add({
      ...entry,
      created_at: new Date()
    });
  },
  
  async updateTimeEntry(id, updates) {
    return await db.time_entries.update(id, updates);
  },
  
  async deleteTimeEntry(id) {
    return await db.time_entries.delete(id);
  },
  
  // Settings
  async getSetting(key) {
    const setting = await db.settings.where('key').equals(key).first();
    return setting ? setting.value : null;
  },
  
  async setSetting(key, value) {
    const existing = await db.settings.where('key').equals(key).first();
    if (existing) {
      return await db.settings.update(existing.id, { value });
    } else {
      return await db.settings.add({ key, value });
    }
  },
  
  // Analytics
  async getAnalytics() {
    const projects = await this.getProjects();
    const tasks = await this.getTasks();
    const timeEntries = await this.getTimeEntries();
    
    const activeProjects = projects.filter(p => p.status === 'active').length;
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const totalTasks = tasks.length;
    
    // Calculate billable vs non-billable hours
    const billableHours = timeEntries
      .filter(entry => entry.billable && entry.duration)
      .reduce((sum, entry) => sum + entry.duration, 0);
    
    const nonBillableHours = timeEntries
      .filter(entry => !entry.billable && entry.duration)
      .reduce((sum, entry) => sum + entry.duration, 0);
    
    const totalHours = billableHours + nonBillableHours;
    
    const overdueTasks = tasks.filter(t => 
      t.deadline && new Date(t.deadline) < new Date() && t.status !== 'done'
    ).length;
    
    return {
      activeProjects,
      completedTasks,
      totalTasks,
      totalHours: Math.round(totalHours * 10) / 10,
      billableHours: Math.round(billableHours * 10) / 10,
      nonBillableHours: Math.round(nonBillableHours * 10) / 10,
      overdueTasks,
      completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      // Time tracking analytics
      hoursData: [
        { name: 'Billable', value: billableHours, color: '#10B981' },
        { name: 'Non-billable', value: nonBillableHours, color: '#94A3B8' }
      ]
    };
  },
  
  // Project-specific analytics
  async getProjectAnalytics(projectId) {
    const tasks = await this.getTasks(projectId);
    const timeEntries = await this.getTimeEntries(null, projectId);
    
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const totalTasks = tasks.length;
    
    const billableHours = timeEntries
      .filter(entry => entry.billable && entry.duration)
      .reduce((sum, entry) => sum + entry.duration, 0);
    
    const nonBillableHours = timeEntries
      .filter(entry => !entry.billable && entry.duration)
      .reduce((sum, entry) => sum + entry.duration, 0);
    
    return {
      completedTasks,
      totalTasks,
      billableHours: Math.round(billableHours * 10) / 10,
      nonBillableHours: Math.round(nonBillableHours * 10) / 10,
      totalHours: Math.round((billableHours + nonBillableHours) * 10) / 10,
      completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      hoursData: [
        { name: 'Billable', value: billableHours, color: '#10B981' },
        { name: 'Non-billable', value: nonBillableHours, color: '#94A3B8' }
      ]
    };
  }
};

export default db;
