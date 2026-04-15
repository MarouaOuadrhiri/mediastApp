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
  columnIds = ['BLOCKED', 'IN PROGRESS', 'REVIEW', 'DONE', 'ARCHIVED'];
  
  // Grouped tasks for Drag and Drop
  boardTasks: { [key: string]: any[] } = {
    'BLOCKED': [],
    'IN PROGRESS': [],
    'REVIEW': [],
    'DONE': [],
    'ARCHIVED': []
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

  /** Tracks which project groups are expanded in list view */
  expandedProjects: Set<string> = new Set();
  /** Tracks which individual tasks are expanded to show details in list view */
  expandedTasks: Set<string> = new Set();

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
      'BLOCKED': this.tasks.filter(t => t.status === 'BLOCKED' && !t.is_archived),
      'IN PROGRESS': this.tasks.filter(t => t.status === 'IN PROGRESS' && !t.is_archived),
      'REVIEW': this.tasks.filter(t => t.status === 'REVIEW' && !t.is_archived),
      'DONE': this.tasks.filter(t => t.status === 'DONE' && !t.is_archived),
      'ARCHIVED': this.tasks.filter(t => t.is_archived || t.status === 'ARCHIVED')
    };
  }

  mapStatus(status: string): string {
    const s = status?.toUpperCase()?.replace('_', ' ');
    if (s === 'TODO' || s === 'BLOCKED') return 'BLOCKED';
    if (s === 'IN PROGRESS') return 'IN PROGRESS';
    if (s === 'REVIEW') return 'REVIEW';
    if (s === 'DONE') return 'DONE';
    if (s === 'ARCHIVED') return 'ARCHIVED';
    return s || 'IN PROGRESS';
  }

  getRandomPriority() {
    const ps = ['LOW', 'MEDIUM', 'HIGH', 'COMPLETED'];
    return ps[Math.floor(Math.random() * ps.length)];
  }

  isAdmin(): boolean {
    const userJson = localStorage.getItem('user');
    if (!userJson) return false;
    try {
      const user = JSON.parse(userJson);
      return user.role === 'ADMIN';
    } catch {
      return false;
    }
  }

  archiveTask(taskId: string) {
    if (!confirm('Are you sure you want to archive this completed task?')) return;
    
    this.api.updateTaskStatus(taskId, undefined, true).subscribe({
      next: () => {
        this.loadData();
      },
      error: () => {
        this.errorMsg = 'Failed to archive task.';
      }
    });
  }

  /** Returns tasks whose status is DONE — shown in Archive view */
  get archivedTasks(): any[] {
    return this.tasks.filter(t => t.is_archived);
  }

  /** Look up project name by id */
  getProjectName(projectId: string): string {
    if (!projectId) return 'No Project';
    const p = this.projects.find((pr: any) => pr.id === projectId);
    return p ? p.name : 'Unknown Project';
  }

  /** Group all tasks by project for the list accordion view */
  get groupedByProject(): { projectId: string; projectName: string; tasks: any[] }[] {
    const map = new Map<string, any[]>();
    for (const t of this.tasks) {
      const key = t.project_id || '__none__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    // Initialise all groups as expanded on first load
    if (this.expandedProjects.size === 0) {
      map.forEach((_, key) => this.expandedProjects.add(key));
    }
    return Array.from(map.entries()).map(([projectId, tasks]) => ({
      projectId,
      projectName: this.getProjectName(projectId === '__none__' ? '' : projectId),
      tasks
    }));
  }

  toggleProject(projectId: string) {
    if (this.expandedProjects.has(projectId)) {
      this.expandedProjects.delete(projectId);
    } else {
      this.expandedProjects.add(projectId);
    }
  }

  toggleTaskDetails(taskId: string) {
    if (this.expandedTasks.has(taskId)) {
      this.expandedTasks.delete(taskId);
    } else {
      this.expandedTasks.add(taskId);
    }
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
      const statusToSave = newStatus.replace(' ', '_');
      this.api.updateTaskStatus(task.id, statusToSave).subscribe({
        next: () => {
          task.status = statusToSave; // Update local status property
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

  getTaskColor(t: any): string {
    if (t.priority === 'HIGH' || t.priority === 'URGENT') return 'red';
    if (t.progress >= 80) return 'green';
    if (t.progress >= 30) return 'orange';
    return 'dim';
  }
}
