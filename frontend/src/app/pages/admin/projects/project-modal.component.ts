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
  isReadOnly = false;

  projectName = '';
  projectClient = '';
  projectDesc = '';
  projectDepartmentId = '';
  projectEmployeeIds: string[] = [];
  projectDeadline = '';
  projectStartDate = '';
  projectTasks: { id?: string, title: string, description?: string, note?: string, assigned_to?: string, assigned_to_name?: string }[] = [];

  // New fields
  projectOwner = '';
  projectStatus = 'Pending';
  isHighPriority = false;
  projectBudget = '';
  projectDuration = '';

  employees: any[] = [];
  departments: any[] = [];
  filteredEmployees: any[] = [];
  showEmployeeDropdown = false;
  
  isConfirmingPassword = false;
  adminPassword = '';
  confirmPasswordError = '';

  private modalSub: Subscription | null = null;

  constructor(private api: ApiService, private ui: UiService) { }

  ngOnInit() {
    this.loadData();
    this.modalSub = this.ui.openProjectModal$.subscribe(({ project, mode }) => {
      if (project) {
        if (mode === 'view') {
          this.openViewModal(project);
        } else {
          this.openEditModal(project);
        }
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
      error: () => { }
    });
    this.api.getDepartments().subscribe({
      next: (r: any) => {
        this.departments = r;
      },
      error: () => { }
    });
  }

  openCreateModal() {
    this.resetForm();
    this.isEditingMode = false;
    this.isReadOnly = false;
    this.showProjectModal = true;
  }

  openEditModal(p: any) {
    this.resetForm();
    this.isEditingMode = true;
    this.isReadOnly = false;
    this.editingProjectId = p.id;
    this.projectName = p.name;
    this.projectClient = p.client || '';
    this.projectDesc = p.description || '';
    this.projectDepartmentId = p.department_id || '';
    this.filterEmployees();
    this.projectEmployeeIds = p.employees?.map((e: any) => e.id) || [];
    this.projectDeadline = p.deadline ? p.deadline.slice(0, 16) : '';
    this.projectStartDate = p.start_date ? p.start_date.slice(0, 16) : '';
    this.projectOwner = p.owner || '';
    this.projectStatus = p.status || 'Pending';
    this.isHighPriority = p.is_high_priority || false;
    this.projectBudget = p.budget || '';
    this.projectDuration = p.duration || '';
    
    this.projectTasks = p.tasks?.map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      note: t.note,
      assigned_to: t.assigned_to,
      assigned_to_name: t.assigned_to_name
    })) || [];
    this.showProjectModal = true;
  }

  openViewModal(p: any) {
    this.openEditModal(p);
    this.isReadOnly = true;
    this.isEditingMode = false;
  }

  closeModal() {
    this.showProjectModal = false;
    this.resetForm();
    this.isConfirmingPassword = false;
    this.adminPassword = '';
    this.confirmPasswordError = '';
  }

  resetForm() {
    this.projectName = '';
    this.projectClient = '';
    this.projectDesc = '';
    this.projectDepartmentId = '';
    this.projectEmployeeIds = [];
    this.projectDeadline = '';
    this.projectStartDate = '';
    this.projectTasks = [];
    this.projectOwner = '';
    this.projectStatus = 'Pending';
    this.isHighPriority = false;
    this.projectBudget = '';
    this.projectDuration = '';
    this.errorMsg = '';
    this.isEditingMode = false;
    this.isReadOnly = false;
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
    // Auto-select all employees of the selected department
    if (this.projectDepartmentId) {
      const deptMembers = this.employees
        .filter(e => e.department_id === this.projectDepartmentId)
        .map(e => e.id);
      
      // Merge with existing selected IDs, ensuring no duplicates
      const newSelection = new Set([...this.projectEmployeeIds, ...deptMembers]);
      this.projectEmployeeIds = Array.from(newSelection);
    }
  }

  toggleEmployee(eId: string) {
    const index = this.projectEmployeeIds.indexOf(eId);
    if (index === -1) {
      this.projectEmployeeIds.push(eId);
    } else {
      this.projectEmployeeIds.splice(index, 1);
    }
  }

  isEmployeeSelected(eId: string): boolean {
    return this.projectEmployeeIds.includes(eId);
  }

  getSelectedEmployees() {
    return this.employees.filter(e => this.projectEmployeeIds.includes(e.id));
  }

  addProjectTask() {
    this.projectTasks.push({ title: '', assigned_to: '' });
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

    this.isConfirmingPassword = true;
    this.adminPassword = '';
    this.confirmPasswordError = '';
  }

  confirmAction() {
    if (!this.adminPassword) {
      this.confirmPasswordError = 'Password is required.';
      return;
    }

    this.isSubmitting = true;
    this.api.verifyPassword(this.adminPassword).subscribe({
      next: (res) => {
        if (res.success) {
          this.executeSubmit();
        } else {
          this.confirmPasswordError = 'Incorrect password.';
          this.isSubmitting = false;
        }
      },
      error: (err) => {
        this.confirmPasswordError = err.error?.error || 'Verification failed.';
        this.isSubmitting = false;
      }
    });
  }

  executeSubmit() {
    const validTasks = this.projectTasks.filter(t => t.title && t.title.trim());

    let deadlineIso = '';
    try {
      deadlineIso = new Date(this.projectDeadline).toISOString();
    } catch {
      this.errorMsg = 'Invalid date format.';
      this.isSubmitting = false;
      return;
    }

    const payload = {
      name: this.projectName,
      client: this.projectClient,
      description: this.projectDesc,
      department_id: this.projectDepartmentId || undefined,
      employee_ids: this.projectEmployeeIds,
      deadline: deadlineIso,
      start_date: this.projectStartDate ? new Date(this.projectStartDate).toISOString() : undefined,
      tasks: validTasks,
      owner: this.projectOwner || undefined,
      status: this.projectStatus,
      is_high_priority: this.isHighPriority,
      budget: this.projectBudget,
      duration: this.projectDuration
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
        this.isConfirmingPassword = false;
      }
    });
  }
}
