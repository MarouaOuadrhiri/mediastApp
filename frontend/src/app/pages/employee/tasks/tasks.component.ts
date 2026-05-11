import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ApiService } from '../../../core/api.service';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-employee-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './tasks.component.html',
  styleUrls: ['./tasks.component.css']
})
export class TasksComponent implements OnInit {
  projects: any[] = [];
  standaloneTasks: any[] = [];
  todoTasks: any[] = [];
  inProgressTasks: any[] = [];
  reviewTasks: any[] = [];
  doneTasks: any[] = [];

  viewMode: 'kanban' | 'list' = 'kanban';
  listStatuses = ['TODO', 'IN PROGRESS', 'REVIEW', 'DONE'];
  expandedStatusGroups: Set<string> = new Set(['TODO', 'IN PROGRESS', 'REVIEW', 'DONE']);

  isDragging = false;
  isUpdating = false;
  private updateTimeout: any;

  // Rejection Flow
  showRejectionModal = false;
  selectedTaskForRejection: any = null;
  rejectionReason = '';

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadData();
    }
  }

  loadData() {
    if (this.isDragging || this.isUpdating) return;

    this.api.getMyProjects().subscribe({
      next: (r: any) => {
        this.projects = r || [];
        this.updateTaskLists();
        this.cdr.detectChanges();
      }
    });

    this.api.getTasks().subscribe({
      next: (r: any) => {
        this.standaloneTasks = r || [];
        this.updateTaskLists();
        this.cdr.detectChanges();
      },
      error: () => {
        this.standaloneTasks = [];
        this.updateTaskLists();
        this.cdr.detectChanges();
      }
    });
  }

  updateTaskLists() {
    let all = this.getAllTasks();
    
    // Sort non-done tasks by deadline urgency (closest deadline first)
    const sortByDeadline = (a: any, b: any) => {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    };

    this.todoTasks = all.filter(t => t.status === 'TODO' || t.status === 'BLOCKED').sort(sortByDeadline);
    this.inProgressTasks = all.filter(t => t.status === 'IN_PROGRESS').sort(sortByDeadline);
    this.reviewTasks = all.filter(t => t.status === 'REVIEW').sort(sortByDeadline);
    this.doneTasks = all.filter(t => t.status === 'DONE');
  }

  getAllTasks(): any[] {
    const all: any[] = [];
    
    // Add standalone tasks with project context
    this.standaloneTasks.forEach(t => {
      let projectName = t.project_name || 'BrandShift';
      if (t.project_id) {
        const p = this.projects.find(proj => proj.id === t.project_id);
        if (p) projectName = p.name;
      }
      all.push({ ...t, project_name: projectName, is_project_task: false });
    });

    // Aggregate project tasks that are assigned to the employee
    this.projects.forEach(p => {
      if (p.tasks) {
        p.tasks.forEach((pt: any) => {
          // Only add if not already in standaloneTasks (prevent duplicates)
          const exists = this.standaloneTasks.some(st => st.source_project_task_id === pt.id || st.title === pt.title);
          if (!exists) {
            all.push({
              ...pt,
              project_id: p.id,
              project_name: p.name,
              is_project_task: true
            });
          }
        });
      }
    });

    return all;
  }

  toggleStatusGroup(status: string) {
    if (this.expandedStatusGroups.has(status)) {
      this.expandedStatusGroups.delete(status);
    } else {
      this.expandedStatusGroups.add(status);
    }
  }

  /** Returns the number of days remaining (negative = overdue) */
  getDaysLeft(deadline: string | undefined): number | null {
    if (!deadline) return null;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Ensure we only use the date part to avoid timezone/time-of-day shifts
      const datePart = deadline.split('T')[0];
      const dlDate = new Date(datePart);
      
      if (isNaN(dlDate.getTime())) {
        console.warn('Invalid deadline format:', deadline);
        return null;
      }
      
      dlDate.setHours(0, 0, 0, 0);
      return Math.ceil((dlDate.getTime() - today.getTime()) / 86400000);
    } catch (e) {
      return null;
    }
  }

  /** Returns a human-readable deadline badge text */
  getDaysLeftText(deadline: string | undefined): string {
    const days = this.getDaysLeft(deadline);
    if (days === null) return 'NO DEADLINE';
    if (days < 0) return `${Math.abs(days)}D OVERDUE`;
    if (days === 0) return 'DUE TODAY';
    if (days === 1) return '1 DAY LEFT';
    return `${days} DAYS LEFT`;
  }

  /** Returns the CSS class for the urgency level */
  getDeadlineClass(deadline: string | undefined): string {
    const days = this.getDaysLeft(deadline);
    if (days === null) return 'deadline-neutral';
    if (days < 0) return 'deadline-overdue';
    if (days <= 2) return 'deadline-critical';
    if (days <= 5) return 'deadline-warning';
    return 'deadline-safe';
  }

  /** Whether the task should be marked as URGENT */
  isUrgent(task: any): boolean {
    if (task.status === 'DONE') return false;
    const days = this.getDaysLeft(task.deadline);
    return days !== null && days <= 2;
  }

  /** Returns progress percentage based on status */
  getProgressByStatus(status: string): number {
    switch (status) {
      case 'DONE': return 100;
      case 'REVIEW': return 90;
      case 'IN_PROGRESS': return 50;
      default: return 0; // TODO, BLOCKED, etc.
    }
  }

  getTasksByListStatus(status: string): any[] {
    switch (status) {
      case 'TODO': return this.todoTasks;
      case 'IN PROGRESS': return this.inProgressTasks;
      case 'REVIEW': return this.reviewTasks;
      case 'DONE': return this.doneTasks;
      default: return [];
    }
  }

  drop(event: CdkDragDrop<any[]>, targetStatus: string) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      const task = event.previousContainer.data[event.previousIndex];
      const apiStatus = targetStatus;

      this.isUpdating = true;
      
      const updateObs = task.is_project_task 
        ? this.api.updateProjectTaskStatus(task.project_id, task.id, apiStatus)
        : this.api.updateTaskStatus(task.id, apiStatus);

      updateObs.subscribe({
        next: () => {
          transferArrayItem(
            event.previousContainer.data,
            event.container.data,
            event.previousIndex,
            event.currentIndex
          );
          task.status = apiStatus;
          this.isUpdating = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.isUpdating = false;
          this.loadData();
          this.cdr.detectChanges();
        }
      });
    }
    this.isDragging = false;
    this.cdr.detectChanges();
  }

  onDragStarted() {
    this.isDragging = true;
  }

  trackById(index: number, item: any): string {
    return item.id || index.toString();
  }

  openRejectionModal(task: any) {
    this.selectedTaskForRejection = task;
    this.rejectionReason = '';
    this.showRejectionModal = true;
  }

  submitRejection() {
    if (!this.rejectionReason.trim() || !this.selectedTaskForRejection) return;
    
    const task = this.selectedTaskForRejection;
    const apiStatus = 'BLOCKED';

    this.isUpdating = true;
    
    const updateObs = task.is_project_task 
      ? this.api.updateProjectTaskStatus(task.project_id, task.id, apiStatus, this.rejectionReason, true)
      : this.api.updateTaskStatus(task.id, apiStatus, undefined, this.rejectionReason, true);

    updateObs.subscribe({
      next: () => {
        this.showRejectionModal = false;
        this.selectedTaskForRejection = null;
        this.rejectionReason = '';
        this.isUpdating = false;
        this.loadData();
        this.cdr.detectChanges();
      },
      error: () => {
        this.isUpdating = false;
        this.showRejectionModal = false;
        this.cdr.detectChanges();
      }
    });
  }

  getProjectProgress(p: any): number {
    if (!p.tasks || p.tasks.length === 0) return 0;
    const done = p.tasks.filter((t: any) => t.status === 'DONE').length;
    return Math.round((done / p.tasks.length) * 100);
  }
}
