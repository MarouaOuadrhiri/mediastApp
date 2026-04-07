import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';

@Component({
  selector: 'app-admin-projects',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './projects.component.html',
  styleUrls: ['./projects.component.css']
})
export class ProjectsComponent implements OnInit {
  projects: any[] = [];
  employees: any[] = [];
  departments: any[] = [];
  isSubmitting = false;
  errorMsg = '';

  projectName = '';
  projectDesc = '';
  projectDepartmentId = '';
  projectEmployeeIds: string[] = [];
  projectDeadline = '';
  
  projectTasks: { id?: string, title: string, description?: string, note?: string }[] = [];
  projectSuccess = false;
  
  filteredEmployees: any[] = [];
  isEditingMode = false;
  editingProjectId = '';
  activeFilter: 'ALL' | 'ACTIVE' | 'COMPLETED' = 'ACTIVE';

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.api.getProjects().subscribe({ next: (r: any) => { this.projects = r; }, error: () => {} });
    this.api.getEmployees().subscribe({ next: (r: any) => { this.employees = r; this.filterEmployees(); }, error: () => {} });
    this.api.getDepartments().subscribe({ next: (r: any) => { this.departments = r; }, error: () => {} });
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

  getProjectProgress(p: any): number {
    if (!p.tasks || p.tasks.length === 0) return 0;
    const done = p.tasks.filter((t: any) => t.status === 'DONE').length;
    return Math.round((done / p.tasks.length) * 100);
  }

  getFilteredProjects() {
    if (this.activeFilter === 'ALL') return this.projects;
    if (this.activeFilter === 'COMPLETED') {
      return this.projects.filter(p => this.getProjectProgress(p) === 100 && p.tasks?.length > 0);
    }
    // ACTIVE means not completed (progress < 100 or no tasks)
    return this.projects.filter(p => {
      const prog = this.getProjectProgress(p);
      return prog < 100 || !p.tasks || p.tasks.length === 0;
    });
  }

  addProjectTask() { this.projectTasks.push({ title: '' }); }
  removeProjectTask(i: number) { this.projectTasks.splice(i, 1); }

  editProject(p: any) {
    this.isEditingMode = true;
    this.editingProjectId = p.id;
    this.projectName = p.name;
    this.projectDesc = p.description || '';
    this.projectDepartmentId = p.department_id || '';
    this.filterEmployees();
    this.projectEmployeeIds = p.employees?.map((e: any) => e.id) || [];
    this.projectDeadline = p.deadline ? p.deadline.slice(0, 16) : '';
    this.projectTasks = p.tasks?.map((t: any) => ({ id: t.id, title: t.title, description: t.description, note: t.note })) || [];
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit() {
    this.isEditingMode = false;
    this.editingProjectId = '';
    this.projectName = ''; this.projectDesc = ''; 
    this.projectDepartmentId = ''; this.projectEmployeeIds = [];
    this.filterEmployees();
    this.projectDeadline = ''; this.projectTasks = [];
    this.errorMsg = '';
  }

  deleteProject(id: string) {
    if(confirm('Are you sure you want to delete this project?')) {
      this.api.deleteProject(id).subscribe({
        next: () => this.loadData(),
        error: () => alert('Failed to delete project')
      });
    }
  }

  submitProject() {
    this.errorMsg = '';
    
    if (!this.projectName || !this.projectDeadline) {
      this.errorMsg = 'Please fill the project name and deadline.'; return;
    }
    
    if (!this.projectDepartmentId && this.projectEmployeeIds.length === 0) {
      this.errorMsg = 'Please assign to a department or select at least one employee.'; return;
    }

    const validTasks = this.projectTasks.filter(t => t.title && t.title.trim());

    // Format deadline to ISO
    let deadlineIso = '';
    try {
      deadlineIso = new Date(this.projectDeadline).toISOString();
    } catch {
      this.errorMsg = 'Invalid date format.'; return;
    }

    this.isSubmitting = true;
    const payload = {
      name: this.projectName,
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
        this.cancelEdit();
        this.projectSuccess = true;
        this.isSubmitting = false;
        
        setTimeout(() => this.projectSuccess = false, 4000);
        this.loadData();
      },
      error: (err: any) => {
        this.errorMsg = err.error?.error || 'Failed to save project.';
        this.isSubmitting = false;
      }
    });
  }
}
