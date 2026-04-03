import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';

@Component({
  selector: 'app-employee-dashboard-content',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  projects: any[] = [];
  standaloneTasks: any[] = [];
  errorMsg = '';
  
  newTaskTitle = '';
  isAddingTask = false;
  
  user: any = null;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.api.getMe().subscribe({ next: (r: any) => { this.user = r; }, error: () => {} });
    
    this.api.getMyProjects().subscribe({
      next: (r: any) => { this.projects = r; },
      error: () => { this.errorMsg = 'Failed to load project data.'; }
    });
    
    this.api.getTasks().subscribe({
      next: (r: any) => { this.standaloneTasks = r; },
      error: () => { this.errorMsg = 'Failed to load standalone tasks.'; }
    });
  }

  createStandaloneTask() {
    if (!this.newTaskTitle.trim()) return;
    
    const payload = {
      title: this.newTaskTitle,
      employee_id: this.user.id
    };
    
    this.api.createTask(payload).subscribe({
      next: () => {
        this.newTaskTitle = '';
        this.isAddingTask = false;
        this.loadData();
      },
      error: (err: any) => {
        this.errorMsg = err.error?.error || 'Failed to create task.';
      }
    });
  }

  updateStandaloneTaskStatus(taskId: string, status: string) {
    this.api.updateTaskStatus(taskId, status).subscribe({
      next: () => { this.loadData(); },
      error: () => { this.errorMsg = 'Failed to update task status.'; }
    });
  }

  getTotalActiveTasks(): number {
    let count = 0;
    this.projects.forEach(p => {
      if (p.tasks) count += p.tasks.filter((t: any) => t.status !== 'DONE').length;
    });
    count += this.standaloneTasks.filter((t: any) => t.status !== 'DONE').length;
    return count;
  }

  getOverallProgress(): number {
    let total = 0;
    let done = 0;
    
    this.projects.forEach(p => {
      if (p.tasks) {
        total += p.tasks.length;
        done += p.tasks.filter((t: any) => t.status === 'DONE').length;
      }
    });

    total += this.standaloneTasks.length;
    done += this.standaloneTasks.filter((t: any) => t.status === 'DONE').length;
    
    if (total === 0) return 0;
    return Math.round((done / total) * 100);
  }

  updateProjectTaskStatus(projectId: string, taskId: string, status: string) {
    this.api.updateProjectTaskStatus(projectId, taskId, status).subscribe({
      next: () => {},
      error: (err: any) => { 
        this.errorMsg = err.error?.error || 'Failed to update task status.';
        this.loadData(); // Revert on failure
      }
    });
  }
}
