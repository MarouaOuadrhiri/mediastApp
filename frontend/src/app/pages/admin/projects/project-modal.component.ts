import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';
import { UiService } from '../../../core/ui.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-project-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './project-modal.component.html',
  styleUrls: ['./project-modal.component.css']
})
export class ProjectModalComponent implements OnInit, OnDestroy {
  showProjectModal = false;
  isEditingMode = false;
  editingProjectId = '';
  isSubmitting = false;
  errorMsg = '';
  projectSuccess = false;

  projectName = '';
  projectClient = '';
  projectDesc = '';
  projectDepartmentId = '';
  projectEmployeeIds: string[] = [];
  projectDeadline = '';
  projectTasks: { id?: string, title: string, description?: string, note?: string }[] = [];

  employees: any[] = [];
  departments: any[] = [];
  filteredEmployees: any[] = [];

  private modalSub: Subscription | null = null;

  constructor(private api: ApiService, private ui: UiService) {}

  ngOnInit() {
    this.loadData();
    this.modalSub = this.ui.openProjectModal$.subscribe((project) => {
      if (project) {
        this.openEditModal(project);
      } else {
        this.openCreateModal();
      }
    });
  }

  ngOnDestroy() {
    if (this.modalSub) {
      this.modalSub.unsubscribe();
    }
  }

  loadData() {
    this.api.getEmployees().subscribe({ 
      next: (r: any) => { 
        this.employees = r; 
        this.filterEmployees(); 
      }, 
      error: () => {} 
    });
    this.api.getDepartments().subscribe({ 
      next: (r: any) => { 
        this.departments = r; 
      }, 
      error: () => {} 
    });
  }

  openCreateModal() {
    this.resetForm();
    this.isEditingMode = false;
    this.showProjectModal = true;
  }

  openEditModal(p: any) {
    this.resetForm();
    this.isEditingMode = true;
    this.editingProjectId = p.id;
    this.projectName = p.name;
    this.projectClient = p.client || '';
    this.projectDesc = p.description || '';
    this.projectDepartmentId = p.department_id || '';
    this.filterEmployees();
    this.projectEmployeeIds = p.employees?.map((e: any) => e.id) || [];
    this.projectDeadline = p.deadline ? p.deadline.slice(0, 16) : '';
    this.projectTasks = p.tasks?.map((t: any) => ({ 
      id: t.id, 
      title: t.title, 
      description: t.description, 
      note: t.note 
    })) || [];
    this.showProjectModal = true;
  }

  closeModal() {
    this.showProjectModal = false;
    this.resetForm();
  }

  resetForm() {
    this.projectName = '';
    this.projectClient = '';
    this.projectDesc = '';
    this.projectDepartmentId = '';
    this.projectEmployeeIds = [];
    this.projectDeadline = '';
    this.projectTasks = [];
    this.errorMsg = '';
    this.isEditingMode = false;
    this.editingProjectId = '';
  }

  filterEmployees() {
    if (!this.projectDepartmentId) {
      this.filteredEmployees = [...this.employees];
    } else {
      this.filteredEmployees = this.employees.filter(e => e.department_id === this.projectDepartmentId);
    }
  }

  onDepartmentChange() {
    this.filterEmployees();
  }

  addProjectTask() { 
    this.projectTasks.push({ title: '' }); 
  }

  removeProjectTask(i: number) { 
    this.projectTasks.splice(i, 1); 
  }

  submitProject() {
    this.errorMsg = '';

    if (!this.projectName || !this.projectDeadline) {
      this.errorMsg = 'Please fill the project name and deadline.';
      return;
    }

    if (!this.projectDepartmentId && this.projectEmployeeIds.length === 0) {
      this.errorMsg = 'Please assign to a department or select at least one employee.';
      return;
    }

    const validTasks = this.projectTasks.filter(t => t.title && t.title.trim());

    let deadlineIso = '';
    try {
      deadlineIso = new Date(this.projectDeadline).toISOString();
    } catch {
      this.errorMsg = 'Invalid date format.';
      return;
    }

    this.isSubmitting = true;
    const payload = {
      name: this.projectName,
      client: this.projectClient,
      description: this.projectDesc,
      department_id: this.projectDepartmentId || undefined,
      employee_ids: this.projectEmployeeIds,
      deadline: deadlineIso,
      tasks: validTasks
    };

    const req = this.isEditingMode
      ? this.api.updateProject(this.editingProjectId, payload)
      : this.api.createProject(payload);

    req.subscribe({
      next: () => {
        this.isSubmitting = false;
        this.ui.notifyProjectChanged();
        this.closeModal();
      },
      error: (err: any) => {
        this.errorMsg = err.error?.error || 'Failed to save project.';
        this.isSubmitting = false;
      }
    });
  }
}
