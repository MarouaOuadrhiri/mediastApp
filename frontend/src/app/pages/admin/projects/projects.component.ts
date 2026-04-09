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
  searchQuery = '';

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
  activeFilter = 'ALL';
  showProjectModal = false;
  selectedPriorityProjectId = localStorage.getItem('selectedPriorityProjectId') || '';

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.api.getProjects().subscribe({ next: (r: any) => {
      this.projects = (r || []).map((project: any) => ({
        ...project,
        isPriority: project.id === this.selectedPriorityProjectId || !!project.isPriority
      }));
    }, error: () => {} });
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

  projectMatches(p: any): boolean {
    const query = this.searchQuery.trim().toLowerCase();
    if (!query) return true;
    const text = [
      p.name,
      p.description,
      p.department_name || '',
      ...(p.employees || []).map((e: any) => e.username || ''),
      ...(p.tasks || []).map((t: any) => t.title || '')
    ].join(' ').toLowerCase();
    return text.includes(query);
  }

  getFilteredProjects() {
    const filtered = this.projects.filter(p => this.projectMatches(p));
    if (this.activeFilter === 'DONE') {
      return filtered.filter(p => this.getProjectProgress(p) === 100 && p.tasks?.length > 0);
    }
    if (this.activeFilter === 'PENDING') {
      return filtered.filter(p => p.tasks && p.tasks.length > 0 && p.tasks.every((t: any) => t.status === 'TODO'));
    }
    if (this.activeFilter === 'IN_PROGRESS') {
      return filtered.filter(p => {
        const prog = this.getProjectProgress(p);
        return prog > 0 && prog < 100;
      });
    }
    return filtered;
  }

  get activeProjects() {
    return this.getFilteredProjects().filter(p => this.getProjectProgress(p) < 100);
  }

  get heroProject() {
    const active = this.activeProjects;
    const priority = active.find(p => p.isPriority);
    return priority ?? active[0];
  }

  get cardProjects() {
    const hero = this.heroProject;
    return this.activeProjects.filter(p => p !== hero);
  }

  get ArchivedProjects() {
    return this.getFilteredProjects().filter(p => this.getProjectProgress(p) === 100 && p.tasks?.length > 0);
  }

  get systemMetrics() {
    const total = this.projects.length;
    if (total === 0) return { completion: '0.0', active: 0, upcoming: 0 };

    let allTasks = 0;
    let doneTasks = 0;
    let active = 0;
    let upcoming = 0;
    const now = new Date().getTime();

    this.projects.forEach(p => {
      if (p.tasks) {
        allTasks += p.tasks.length;
        doneTasks += p.tasks.filter((t: any) => t.status === 'DONE').length;
      }
      if (this.getProjectProgress(p) < 100) active++;
      if (p.deadline) {
        const d = new Date(p.deadline).getTime();
        const diffDays = (d - now) / (1000 * 3600 * 24);
        if (diffDays >= 0 && diffDays <= 7) upcoming++;
      }
    });

    const completion = allTasks > 0 ? (doneTasks / allTasks * 100).toFixed(1) : '0.0';
    return { completion, active, upcoming };
  }

  openModal() {
    this.showProjectModal = true;
  }

  closeModal() {
    this.cancelEdit();
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
    this.showProjectModal = true;
  }

  cancelEdit() {
    this.isEditingMode = false;
    this.editingProjectId = '';
    this.projectName = '';
    this.projectDesc = '';
    this.projectDepartmentId = '';
    this.projectEmployeeIds = [];
    this.filterEmployees();
    this.projectDeadline = '';
    this.projectTasks = [];
    this.errorMsg = '';
    this.showProjectModal = false;
  }

  deleteProject(id: string) {
    if (confirm('Are you sure you want to delete this project?')) {
      this.api.deleteProject(id).subscribe({
        next: () => this.loadData(),
        error: () => alert('Failed to delete project')
      });
    }
  }

  setPriorityProject(project: any) {
    if (!project?.id) return;
    this.selectedPriorityProjectId = project.id;
    localStorage.setItem('selectedPriorityProjectId', project.id);
    this.projects = this.projects.map(p => ({ ...p, isPriority: p.id === project.id }));
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
