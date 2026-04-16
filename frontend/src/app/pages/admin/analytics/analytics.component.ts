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
  stats = {
    totalEmployees: 0,
    activeTasks: 0,
    completedTasks: 0,
    avgCompletionRate: 0,
    departmentStats: [] as any[]
  };

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.api.getEmployees().subscribe(emps => {
      this.employees = emps;
      this.stats.totalEmployees = emps.length;
      this.calculateStats();
    });

    this.api.getTasks().subscribe(tasks => {
      this.tasks = tasks;
      this.calculateStats();
    });
  }

  calculateStats() {
    if (!this.tasks.length) return;

    this.stats.activeTasks = this.tasks.filter(t => t.status !== 'DONE' && t.status !== 'ARCHIVED').length;
    this.stats.completedTasks = this.tasks.filter(t => t.status === 'DONE').length;
    
    const total = this.stats.activeTasks + this.stats.completedTasks;
    this.stats.avgCompletionRate = total > 0 ? Math.round((this.stats.completedTasks / total) * 100) : 0;

    // Group by department
    const deptMap = new Map();
    this.tasks.forEach(t => {
      const dept = t.department_name || 'General';
      if (!deptMap.has(dept)) deptMap.set(dept, { name: dept, total: 0, completed: 0 });
      const stats = deptMap.get(dept);
      stats.total++;
      if (t.status === 'DONE') stats.completed++;
    });

    this.stats.departmentStats = Array.from(deptMap.values()).map(d => ({
      ...d,
      percent: Math.round((d.completed / d.total) * 100) || 0
    }));
  }
}
