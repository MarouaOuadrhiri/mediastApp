import { Component, OnInit, OnDestroy, PLATFORM_ID, Inject, HostListener, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';
import { UiService } from '../../../core/ui.service';
import { Subscription } from 'rxjs';

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
  errorMsg = '';
  searchQuery = '';
  activeFilter = 'ALL';
  selectedPriorityProjectId = '';
  openMenuId: string | null = null;
  loading = false;
  private modalSub: Subscription | null = null;

  // Pagination
  currentPage = 1;
  itemsPerPage = 12; // 4 rows * 3 columns

  get totalPages(): number {
    const totalCount = this.displayProjects.length;
    // Page 1 uses 11 slots (Hero=2, others=9) or 12 if no Hero
    const firstPageCount = this.heroProject ? 10 : 12; 
    const remaining = Math.max(0, totalCount - firstPageCount);
    return 1 + Math.ceil(remaining / this.itemsPerPage);
  }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    const limit = Math.min(total, 5);
    return Array.from({ length: limit }, (_, i) => i + 1);
  }

  // Projects for the current page (excluding Hero)
  get pagedProjects() {
    if (this.currentPage === 1) {
      // Page 1: topThree (3) + fourthProject (1) + next 6 (Rows 3 & 4)
      const others = this.displayProjects.filter(p => p.id !== this.heroProject?.id);
      return others.slice(0, 10); // 3 + 1 + 6 = 10
    } else {
      // Page 2+: Standard 12 items
      const firstPageCount = this.heroProject ? 10 : 0;
      const others = this.displayProjects.filter(p => p.id !== this.heroProject?.id);
      const start = firstPageCount + (this.currentPage - 2) * this.itemsPerPage;
      return others.slice(start, start + this.itemsPerPage);
    }
  }

  setPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  constructor(
    private api: ApiService,
    private ui: UiService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) { }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.selectedPriorityProjectId = localStorage.getItem('selectedPriorityProjectId') || '';
      this.loadData();
      this.modalSub = this.ui.projectEdited$.subscribe(() => {
        this.loadData();
      });
    }
  }

  ngOnDestroy() {
    if (this.modalSub) {
      this.modalSub.unsubscribe();
    }
  }

  loadData() {
    this.loading = true;
    this.cdr.markForCheck();

    this.api.getProjects().subscribe({
      next: (r: any) => {
        this.zone.run(() => {
          this.projects = (r || []).map((project: any) => ({
            ...project,
            isPriority: project.id === this.selectedPriorityProjectId || !!project.isPriority
          }));
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: () => { 
        this.zone.run(() => {
          this.loading = false;
          this.cdr.detectChanges();
        });
      }
    });

    this.api.getEmployees().subscribe({ 
      next: (r: any) => { 
        this.zone.run(() => {
          this.employees = r; 
          this.cdr.detectChanges();
        });
      } 
    });

    this.api.getDepartments().subscribe({ 
      next: (r: any) => { 
        this.zone.run(() => {
          this.departments = r; 
          this.cdr.detectChanges();
        });
      } 
    });
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
      return filtered.filter(p => this.getProjectProgress(p) === 100);
    }
    if (this.activeFilter === 'PENDING') {
      return filtered.filter(p => this.getProjectProgress(p) === 0);
    }
    if (this.activeFilter === 'IN_PROGRESS') {
      return filtered.filter(p => {
        const prog = this.getProjectProgress(p);
        return prog > 0 && prog < 100;
      });
    }
    return filtered;
  }

  get displayProjects() {
    return this.getFilteredProjects();
  }

  get topThree() {
    return this.displayProjects.filter(p => p.id !== this.heroProject?.id).slice(0, 3);
  }

  get fourthProject() {
    const others = this.displayProjects.filter(p => p.id !== this.heroProject?.id);
    return others.length >= 4 ? others[3] : null;
  }

  get remainingProjects() {
    const others = this.displayProjects.filter(p => p.id !== this.heroProject?.id);
    return others.slice(4);
  }

  get heroProject() {
    const projects = this.displayProjects;
    if (projects.length === 0) return null;
    const priority = projects.find(p => p.isPriority);
    return priority || null;
  }

  get ArchivedProjects() {
    // Keep this for any metrics or logic that still needs high-level stats
    return this.projects.filter(p => this.getProjectProgress(p) === 100 && p.tasks?.length > 0);
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

  editProject(p: any) {
    this.openMenuId = null;
    this.ui.triggerOpenProjectModal(p, 'edit');
  }

  toggleFavorite(p: any) {
    this.openMenuId = null;
    this.setPriorityProject(p);
  }

  detailProject(p: any) {
    this.openMenuId = null;
    this.ui.triggerOpenProjectModal(p, 'view');
  }

  toggleMenu(id: string, event: Event) {
    event.stopPropagation();
    this.openMenuId = this.openMenuId === id ? null : id;
  }

  @HostListener('document:click')
  closeMenus() {
    this.openMenuId = null;
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
}
