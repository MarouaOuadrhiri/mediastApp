import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';

@Component({
  selector: 'app-admin-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tasks.component.html',
  styleUrls: ['./tasks.component.css']
})
export class TasksComponent implements OnInit {
  tasks: any[] = [];
  employees: any[] = [];
  isSubmitting = false;
  errorMsg = '';

  taskTitle = '';
  taskDesc = '';
  taskEmployeeId = '';
  editTaskId: string | null = null;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.api.getTasks().subscribe({ next: (r: any) => { this.tasks = r; }, error: () => {} });
    this.api.getEmployees().subscribe({ next: (r: any) => { this.employees = r; }, error: () => {} });
  }

  createTask() {
    if (!this.taskTitle || !this.taskEmployeeId) { this.errorMsg = 'Please fill all fields.'; return; }
    this.isSubmitting = true;
    this.api.createTask({ title: this.taskTitle, description: this.taskDesc, employee_id: this.taskEmployeeId }).subscribe({
      next: () => { this.taskTitle = ''; this.taskDesc = ''; this.isSubmitting = false; this.loadData(); },
      error: (err: any) => { this.errorMsg = err.error?.error || 'Failed to create task.'; this.isSubmitting = false; }
    });
  }

  startEditTask(t: any) { this.editTaskId = t.id; t.editTitle = t.title; t.editDesc = t.description; t.editEmployeeId = t.employee_id; }
  saveEditTask(t: any) {
    this.api.updateTask(t.id, { title: t.editTitle, description: t.editDesc, employee_id: t.editEmployeeId }).subscribe({
      next: () => { this.editTaskId = null; this.loadData(); },
      error: (err: any) => { this.errorMsg = err.error?.error || 'Failed to update task.'; }
    });
  }
}
