import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
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

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadData();
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
        if (r && r.length > 0) {
          this.standaloneTasks = r;
        } else {
          this.setMockTasks();
        }
        this.updateTaskLists();
        this.cdr.detectChanges();
      },
      error: () => {
        this.setMockTasks();
        this.updateTaskLists();
        this.cdr.detectChanges();
      }
    });
  }

  private setMockTasks() {
    this.standaloneTasks = [
      {
        id: 't1',
        title: 'Refactor core auth middleware for multi-tenant latency',
        project_name: 'PROJECT: ORION',
        status: 'BLOCKED',
        priority: 'HIGH',
        deadline: '2026-10-12',
        progress: 30
      },
      {
        id: 't2',
        title: 'Motion blur-to-focus utility components',
        project_name: 'DESIGN SYSTEM',
        status: 'BLOCKED',
        priority: 'MED',
        deadline: '2026-10-15',
        progress: 10
      },
      {
        id: 't3',
        title: 'API Integration: Stripe Connect High-Velocity Payouts',
        project_name: 'PAYMENTS GATEWAY',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        progress: 68
      },
      {
        id: 't4',
        title: 'Revise architecture diagram for quarterly board review',
        project_name: 'INTERNAL SPECS',
        status: 'IN_PROGRESS',
        deadline: '2026-05-05',
        progress: 42
      },
      {
        id: 't5',
        title: 'Performance audit for mobile landing page experience',
        project_name: 'CLIENT: VANTEDGE',
        status: 'REVIEW',
        progress: 95
      },
      {
        id: 't6',
        title: 'Newsletter asset delivery for Fall campaign launch',
        project_name: 'MARKETING',
        status: 'DONE',
        completed_at: '2026-10-05',
        progress: 100
      }
    ];
  }

  updateTaskLists() {
    const all = this.getAllTasks();
    this.todoTasks = all.filter(t => t.status === 'TODO' || t.status === 'BLOCKED');
    this.inProgressTasks = all.filter(t => t.status === 'IN_PROGRESS');
    this.reviewTasks = all.filter(t => t.status === 'REVIEW');
    this.doneTasks = all.filter(t => t.status === 'DONE');
  }

  getAllTasks(): any[] {
    return this.standaloneTasks.map(t => {
      let projectName = t.project_name || 'BrandShift';
      if (t.project_id) {
        const p = this.projects.find(proj => proj.id === t.project_id);
        if (p) projectName = p.name;
      }
      return { ...t, project_name: projectName };
    });
  }

  toggleStatusGroup(status: string) {
    if (this.expandedStatusGroups.has(status)) {
      this.expandedStatusGroups.delete(status);
    } else {
      this.expandedStatusGroups.add(status);
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
      let apiStatus = targetStatus;
      if (targetStatus === 'IN_PROGRESS') apiStatus = 'IN_PROGRESS';
      if (targetStatus === 'BLOCKED') apiStatus = 'BLOCKED';
      if (targetStatus === 'TODO') apiStatus = 'TODO';

      const sourceTask = this.standaloneTasks.find(t => t.id === task.id);
      if (sourceTask) sourceTask.status = apiStatus;

      task.status = apiStatus;
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );
      
      this.isUpdating = true;
      this.api.updateTaskStatus(task.id, apiStatus).subscribe({
        next: () => {
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
}
