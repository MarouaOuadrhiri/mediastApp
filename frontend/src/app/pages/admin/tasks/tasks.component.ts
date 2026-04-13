import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';
import { 
  DragDropModule, 
  CdkDragDrop, 
  moveItemInArray, 
  transferArrayItem 
} from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-admin-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './tasks.component.html',
  styleUrls: ['./tasks.component.css']
})
export class TasksComponent implements OnInit {
  tasks: any[] = [];
  employees: any[] = [];
  projects: any[] = [];
  departments: any[] = [];
  columnIds = ['BLOCKED', 'IN PROGRESS', 'REVIEW', 'DONE'];
  
  // Grouped tasks for Drag and Drop
  boardTasks: { [key: string]: any[] } = {
    'BLOCKED': [],
    'IN PROGRESS': [],
    'REVIEW': [],
    'DONE': []
  };

  isSubmitting = false;
  errorMsg = '';
  isModalOpen = false;
  viewMode: 'board' | 'list' = 'board';

  // New task form fields
  taskTitle = '';
  taskDesc = '';
  taskEmployeeId = '';
  taskProjectId = '';
  taskDepartmentId = '';
  taskPriority = 'MEDIUM';
  taskStatus = 'IN PROGRESS';
  taskDeadline = '';
  taskProgress = 0;
  assignedMembers: any[] = [];

  editTaskId: string | null = null;

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    if (!isPlatformBrowser(this.platformId)) return;
    
    this.api.getTasks().subscribe({ 
      next: (r: any) => { 
        this.tasks = r.map((t: any) => ({
          ...t,
          status: this.mapStatus(t.status),
          priority: t.priority || this.getRandomPriority(),
          progress: t.progress || Math.floor(Math.random() * 100),
          deadline: t.deadline || 'MAY 16',
          employee_name: t.employee_name || 'Unknown'
        }));
        this.groupTasks();
        this.cdr.markForCheck();
      }, 
      error: () => {} 
    });
    this.api.getEmployees().subscribe({ next: (r: any) => { this.employees = r; this.cdr.markForCheck(); }, error: () => {} });
    this.api.getProjects().subscribe({ next: (r: any) => { this.projects = r; this.cdr.markForCheck(); }, error: () => {} });
    this.api.getDepartments().subscribe({ next: (r: any) => { this.departments = r; this.cdr.markForCheck(); }, error: () => {} });
  }

  groupTasks() {
    this.boardTasks = {
      'BLOCKED': this.tasks.filter(t => t.status === 'BLOCKED'),
      'IN PROGRESS': this.tasks.filter(t => t.status === 'IN PROGRESS'),
      'REVIEW': this.tasks.filter(t => t.status === 'REVIEW'),
      'DONE': this.tasks.filter(t => t.status === 'DONE')
    };
  }

  mapStatus(status: string): string {
    const s = status?.toUpperCase()?.replace('_', ' ');
    if (s === 'TODO' || s === 'BLOCKED') return 'BLOCKED';
    if (s === 'IN PROGRESS') return 'IN PROGRESS';
    if (s === 'REVIEW') return 'REVIEW';
    if (s === 'DONE') return 'DONE';
    return s || 'IN PROGRESS';
  }

  getRandomPriority() {
    const ps = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
    return ps[Math.floor(Math.random() * ps.length)];
  }

  // Drag and Drop Handler
  drop(event: CdkDragDrop<any[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      const task = event.previousContainer.data[event.previousIndex];
      const newStatus = event.container.id; // We'll set the ID of the list to the status string
      
      // OPTIMISTIC UPDATE: Move locally first
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );

      // Backend update
      this.api.updateTaskStatus(task.id, newStatus.replace(' ', '_')).subscribe({
        next: () => {
          task.status = newStatus; // Update local status property
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.errorMsg = 'Failed to update task status.';
          this.loadData(); // Revert on error
          this.cdr.markForCheck();
        }
      });
      this.cdr.markForCheck();
    }
  }

  // Rest of the methods...
  openModal() { this.isModalOpen = true; }
  closeModal() { this.isModalOpen = false; this.resetForm(); }
  resetForm() {
    this.taskTitle = ''; this.taskDesc = ''; this.taskEmployeeId = ''; this.taskProjectId = '';
    this.taskDepartmentId = ''; this.taskPriority = 'MEDIUM'; this.taskStatus = 'IN PROGRESS';
    this.taskDeadline = ''; this.taskProgress = 0; this.assignedMembers = [];
  }

  createTask() {
    if (!this.taskTitle || !this.taskEmployeeId) { this.errorMsg = 'Please fill all fields.'; return; }
    this.isSubmitting = true;
    const taskData = {
      title: this.taskTitle, description: this.taskDesc, employee_id: this.taskEmployeeId,
      status: this.taskStatus.replace(' ', '_'), priority: this.taskPriority,
      project_id: this.taskProjectId, deadline: this.taskDeadline, progress: this.taskProgress
    };
    this.api.createTask(taskData).subscribe({
      next: () => { this.isSubmitting = false; this.closeModal(); this.loadData(); },
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

  getSelectedEmployee() {
    return this.employees.find(e => e.id === this.taskEmployeeId);
  }
}
