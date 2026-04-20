import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/api.service';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.css'
})
export class AnalyticsComponent implements OnInit {
  employees: any[] = [];
  tasks: any[] = [];
  projects: any[] = [];
  departments: any[] = [];

  stats = {
    totalEmployees: 0,
    activeTasks: 0,
    completedTasks: 0,
    avgCompletionRate: 0,
    avgCompletionChange: '0%',
    weeklyData: [0, 0, 0, 0, 0, 0, 0],
    departmentStats: [] as any[]
  };

  activePulse: any[] = [];
  performanceHours = Array(48).fill(0).map(() => Math.floor(Math.random() * 4));
  
  topPerformer = {
    name: '---',
    performance: '0%',
    tasksClosed: 0,
    avgResponse: '--',
    projectsLed: 0,
    photoPath: ''
  };

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    // Parallel fetch for all core entities
    const subs = {
      emps: this.api.getEmployees(),
      tasks: this.api.getTasks(),
      projs: this.api.getProjects(),
      depts: this.api.getDepartments()
    };

    subs.emps.subscribe({ next: (data: any) => { this.employees = data; this.calculateTopPerformer(); }, error: () => {} });
    subs.tasks.subscribe({ next: (data: any) => { this.tasks = data; this.calculateStats(); }, error: () => {} });
    subs.projs.subscribe({ next: (data: any) => { this.projects = data; this.calculatePulse(); }, error: () => {} });
    subs.depts.subscribe({ next: (data: any) => { this.departments = data; this.calculateStats(); }, error: () => {} });
  }

  calculateStats() {
    if (!this.tasks.length) return;

    this.stats.totalEmployees = this.employees.length;
    this.stats.activeTasks = this.tasks.filter(t => t.status !== 'DONE' && t.status !== 'ARCHIVED').length;
    const completed = this.tasks.filter(t => t.status === 'DONE').length;
    this.stats.completedTasks = completed;
    
    const rate = (completed / this.tasks.length) * 100;
    this.stats.avgCompletionRate = parseFloat(rate.toFixed(1));

    // Calculate department stats
    if (this.departments.length) {
      this.stats.departmentStats = this.departments.map(dept => {
        const deptTasks = this.tasks.filter(t => t.department === dept.id);
        const deptCompleted = deptTasks.filter(t => t.status === 'DONE').length;
        const deptRate = deptTasks.length ? (deptCompleted / deptTasks.length) * 100 : 0;
        return {
          name: dept.name,
          percent: Math.round(deptRate)
        };
      }).sort((a, b) => b.percent - a.percent);
    }

    // Mock weekly trend based on current data for visual continuity
    this.stats.weeklyData = [
      Math.max(0, rate - 20),
      Math.max(0, rate - 15),
      Math.max(0, rate - 25),
      Math.max(0, rate - 10),
      Math.max(0, rate - 5),
      Math.max(0, rate - 2),
      rate
    ];
  }

  calculatePulse() {
    this.activePulse = this.projects.slice(0, 3).map(p => ({
      title: p.name,
      status: p.status || 'IN PROGRESS',
      deadline: p.end_date ? `Due ${new Date(p.end_date).toLocaleDateString()}` : 'No deadline',
      icon: p.category === 'TECH' ? 'zap' : (p.category === 'DESIGN' ? 'pen-tool' : 'rocket')
    }));
  }

  calculateTopPerformer() {
    if (!this.employees.length || !this.tasks.length) return;

    // Find user with most completed tasks
    const completionsMap = new Map<any, number>();
    this.tasks.filter((t: any) => t.status === 'DONE').forEach((t: any) => {
      if (t.assigned_to) {
        completionsMap.set(t.assigned_to, (completionsMap.get(t.assigned_to) || 0) + 1);
      }
    });

    let bestId: any = null;
    let max = -1;
    completionsMap.forEach((count, id) => {
      if (count > max) { max = count; bestId = id; }
    });

    const topUser = this.employees.find(e => e.id === bestId) || this.employees[0];
    if (topUser) {
      this.topPerformer = {
        name: topUser.full_name || topUser.username,
        performance: 'Top Tier',
        tasksClosed: max > 0 ? max : 0,
        avgResponse: 'Fast',
        projectsLed: this.projects.filter(p => p.manager === topUser.id).length,
        photoPath: topUser.profile_image || ''
      };
    }
  }

  // Helper for dynamic initials
  getTopPerformerInitials(): string {
    if (!this.topPerformer.name || this.topPerformer.name === '---') return '??';
    return this.topPerformer.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }

  get chartLinePath(): string {
    if (!this.stats.weeklyData || this.stats.weeklyData.length < 2) return '';
    const width = 557;
    const height = 180;
    const padding = 20;
    const actualHeight = height - padding * 2;
    const points = this.stats.weeklyData.map((val, i) => ({
      x: (i / (this.stats.weeklyData.length - 1)) * width,
      y: height - (val / 100) * actualHeight - padding
    }));
    let path = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cp1x = p0.x + (p1.x - p0.x) / 2;
      const cp1y = p0.y;
      const cp2x = p0.x + (p1.x - p0.x) / 2;
      const cp2y = p1.y;
      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p1.x},${p1.y}`;
    }
    return path;
  }

  get chartFillPath(): string {
    const linePath = this.chartLinePath;
    if (!linePath) return '';
    return `${linePath} V 180 H 0 Z`;
  }
}
