import { Component, OnInit, ChangeDetectorRef, NgZone, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { ApiService } from '../../../core/api.service';

@Component({
  selector: 'app-employee-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  projects: any[] = [];
  standaloneTasks: any[] = [];
  meetings: any[] = [];
  upcomingMeetings: any[] = [];
  newMeetingCount = 0;
  showMeetingPanel = false;

  newTaskTitle = '';
  isAddingTask = false;
  errorMsg = '';
  user: any = null;
  attendanceSession: any = null;
  elapsedTime = '00:00:00';
  private timerInterval: any;
  private refreshInterval: any;

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    this.loadData();
    if (isPlatformBrowser(this.platformId)) {
      this.refreshInterval = setInterval(() => {
        this.loadData(true);
      }, 30000);
    }
  }

  ngOnDestroy() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  private runInZone(fn: () => void) {
    if (this.zone) this.zone.run(fn);
    else fn();
  }

  loadData(isRefresh = false) {
    this.api.getMyProjects().subscribe({
      next: (r: any) => this.runInZone(() => { this.projects = r || []; this.cdr.detectChanges(); }),
      error: () => { if (!isRefresh) this.errorMsg = 'Failed to load project data.'; }
    });

    this.api.getTasks().subscribe({
      next: (r: any) => this.runInZone(() => { this.standaloneTasks = r || []; this.cdr.detectChanges(); }),
      error: () => { if (!isRefresh) this.errorMsg = 'Failed to load tasks.'; }
    });

    this.api.getMeetings().subscribe({
      next: (r: any) => this.runInZone(() => { this.processMeetings(r || []); this.cdr.detectChanges(); }),
      error: () => {}
    });

    if (!isRefresh) {
      this.api.getMe().subscribe({
        next: (r: any) => this.runInZone(() => { this.user = r; this.cdr.detectChanges(); }),
        error: () => {}
      });

      this.api.getCurrentAttendance().subscribe({
        next: (session: any) => this.runInZone(() => {
          if (session) {
            this.attendanceSession = session;
            this.startTimer(session.start_time);
          }
          this.cdr.detectChanges();
        }),
        error: () => {}
      });
    }
  }

  processMeetings(raw: any[]) {
    const now = new Date();
    this.meetings = raw;
    this.upcomingMeetings = raw
      .filter(m => new Date(m.date_time) >= now)
      .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());

    // Count meetings in the next 24 hours as "new/alert"
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    this.newMeetingCount = this.upcomingMeetings.filter(m => new Date(m.date_time) <= in24h).length;
  }

  getMeetingTimeLabel(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffH = Math.floor(diffMs / 3600000);
    const diffM = Math.floor((diffMs % 3600000) / 60000);

    if (diffMs < 0) return 'Passé';
    if (diffH === 0) return `Dans ${diffM}min`;
    if (diffH < 24) return `Dans ${diffH}h${diffM > 0 ? diffM + 'min' : ''}`;
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  isImminent(dateStr: string): boolean {
    const diffMs = new Date(dateStr).getTime() - new Date().getTime();
    return diffMs >= 0 && diffMs <= 60 * 60 * 1000; // within 1 hour
  }

  startTimer(startTime: string) {
    if (!isPlatformBrowser(this.platformId)) return;
    const start = new Date(startTime).getTime();
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (!this.zone) return;

    this.zone.runOutsideAngular(() => {
      this.timerInterval = setInterval(() => {
        const now = new Date().getTime();
        const diff = now - start;
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);

        this.zone.run(() => {
          this.elapsedTime = `${this.pad(h)}:${this.pad(m)}:${this.pad(s)}`;
          this.cdr.detectChanges();
        });
      }, 1000);
    });
  }

  private pad(n: number): string {
    return n < 10 ? '0' + n : '' + n;
  }

  logout() {
    const finalizeLogout = () => {
      if (isPlatformBrowser(this.platformId)) {
        localStorage.clear();
        window.location.href = '/login';
      } else {
        localStorage.clear();
        this.router.navigate(['/login']);
      }
    };

    const isAdmin = localStorage.getItem('role') === 'admin';
    if (isAdmin) {
      finalizeLogout();
    } else {
      this.api.endAttendance().subscribe({ next: finalizeLogout, error: finalizeLogout });
    }
  }

  createStandaloneTask(title?: string, sourceId?: string) {
    const taskTitle = title || this.newTaskTitle;
    if (!taskTitle.trim()) return;

    const payload = {
      title: taskTitle,
      employee_id: this.user.id,
      source_project_task_id: sourceId
    };

    this.api.createTask(payload).subscribe({
      next: () => {
        this.runInZone(() => {
          this.newTaskTitle = '';
          this.isAddingTask = false;
          this.loadData();
        });
      },
      error: (err: any) => {
        this.runInZone(() => {
          this.errorMsg = err.error?.error || 'Failed to create task.';
          this.cdr.detectChanges();
        });
      }
    });
  }

  createTaskFromNote(pt: any) {
    const title = prompt('Enter a title for this individual task:', pt.title);
    if (title) this.createStandaloneTask(title, pt.id);
  }

  hasStandaloneTask(ptId: string): boolean {
    return this.standaloneTasks.some(t => t.source_project_task_id === ptId);
  }

  updateStandaloneTaskStatus(taskId: string, status: string) {
    this.api.updateTaskStatus(taskId, status).subscribe({
      next: () => { this.loadData(); },
      error: () => {
        this.runInZone(() => { this.errorMsg = 'Failed to update task status.'; this.cdr.detectChanges(); });
      }
    });
  }

  getTotalActiveTasks(): number {
    let count = 0;
    this.projects.forEach(p => {
      if (p.tasks) count += p.tasks.filter((t: any) => t.status !== 'DONE').length;
    });
    count += this.standaloneTasks.filter((t: any) => t.status !== 'DONE').length;
    return count;
  }

  getOverallProgress(): number {
    let total = 0;
    let done = 0;

    this.projects.forEach(p => {
      if (p.tasks) {
        total += p.tasks.length;
        done += p.tasks.filter((t: any) => t.status === 'DONE').length;
      }
    });

    total += this.standaloneTasks.length;
    done += this.standaloneTasks.filter((t: any) => t.status === 'DONE').length;

    if (total === 0) return 0;
    return Math.round((done / total) * 100);
  }

  getProjectProgress(p: any): number {
    if (!p || !p.tasks || p.tasks.length === 0) return 0;
    const done = p.tasks.filter((t: any) => t.status === 'DONE').length;
    return Math.round((done / p.tasks.length) * 100);
  }

  updateProjectTaskStatus(projectId: string, taskId: string, status: string) {
    this.api.updateProjectTaskStatus(projectId, taskId, status).subscribe({
      next: () => { this.runInZone(() => { this.cdr.detectChanges(); }); },
      error: (err: any) => {
        this.runInZone(() => {
          this.errorMsg = err.error?.error || 'Failed to update task status.';
          this.loadData();
          this.cdr.detectChanges();
        });
      }
    });
  }
}
