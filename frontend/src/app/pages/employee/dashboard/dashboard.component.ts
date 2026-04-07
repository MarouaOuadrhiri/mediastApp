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
  toastMeeting: any = null;
  private toastTimer: any;
  private lastSeenMeetingIds: Set<string> = new Set();
  private meetingSeenStorageKey = 'employeeMeetingSeenIds';

  newTaskTitle = '';
  isAddingTask = false;
  errorMsg = '';
  user: any = null;
  attendanceSession: any = null;
  elapsedTime = '00:00:00';
  private timerInterval: any;
  private refreshInterval: any;
  private meetingCreatedListener: any;
  private meetingStorageListener: any;
  private employeeShowPanelListener: any;
  private employeeShowPanelActionKey = 'employee-show-meeting-panel';

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    this.loadSeenMeetingIds();
    this.loadData();
    if (isPlatformBrowser(this.platformId)) {
      this.refreshInterval = setInterval(() => {
        this.loadData(true);
      }, 30000);

      this.meetingCreatedListener = (event: any) => {
        const meeting = event?.detail;
        if (meeting && meeting.title) {
          this.showToast(meeting);
          this.loadData(true);
        }
      };
      window.addEventListener('meeting-created', this.meetingCreatedListener);

      this.meetingStorageListener = (event: StorageEvent) => {
        if (event.key === 'meeting-created' && event.newValue) {
          try {
            const payload = JSON.parse(event.newValue);
            const meeting = payload?.meeting;
            if (meeting && meeting.title) {
              this.showToast(meeting);
              this.loadData(true);
            }
          } catch {
            // ignore invalid payload
          }
        }

        if (event.key === 'employee-show-meeting-panel') {
          this.zone.run(() => {
            this.showMeetingPanel = true;
            this.loadData(true);
            this.cdr.detectChanges();
          });
        }
      };
      window.addEventListener('storage', this.meetingStorageListener);

      this.employeeShowPanelListener = () => {
        this.handleEmployeeShowPanel();
      };
      window.addEventListener('employee-show-meeting-panel', this.employeeShowPanelListener);

      this.checkStoredEmployeeShowPanel();
    }
  }

  ngOnDestroy() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    if (this.meetingCreatedListener) window.removeEventListener('meeting-created', this.meetingCreatedListener);
    if (this.meetingStorageListener) window.removeEventListener('storage', this.meetingStorageListener);
    if (this.employeeShowPanelListener) window.removeEventListener('employee-show-meeting-panel', this.employeeShowPanelListener);
  }

  private loadSeenMeetingIds() {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const raw = localStorage.getItem(this.meetingSeenStorageKey);
      if (raw) {
        const ids = JSON.parse(raw) as string[];
        this.lastSeenMeetingIds = new Set(ids || []);
      }
    } catch {
      this.lastSeenMeetingIds = new Set();
    }
  }

  private saveSeenMeetingIds() {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem(this.meetingSeenStorageKey, JSON.stringify([...this.lastSeenMeetingIds]));
    } catch {
      // ignore storage errors
    }
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
      next: (r: any) => this.runInZone(() => { this.processMeetings(r || [], isRefresh); this.cdr.detectChanges(); }),
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

  processMeetings(raw: any[], isRefresh = false) {
    const now = new Date();
    this.meetings = raw;
    this.upcomingMeetings = raw
      .filter(m => new Date(m.date_time) >= now)
      .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());

    // Count meetings in the next 24 hours as "new/alert"
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    this.newMeetingCount = this.upcomingMeetings.filter(m => new Date(m.date_time) <= in24h).length;

    if (isRefresh || this.lastSeenMeetingIds.size > 0) {
      const newOnes = raw.filter(m => m.id && !this.lastSeenMeetingIds.has(m.id));
      raw.forEach(m => { if (m.id) this.lastSeenMeetingIds.add(m.id); });
      this.saveSeenMeetingIds();
      if (newOnes.length > 0) {
        this.showToast(newOnes[newOnes.length - 1]);
      }
    } else {
      raw.forEach(m => { if (m.id) this.lastSeenMeetingIds.add(m.id); });
      this.saveSeenMeetingIds();
    }
  }

  showToast(meeting: any) {
    this.zone.run(() => {
      if (this.toastTimer) clearTimeout(this.toastTimer);
      this.toastMeeting = meeting;
      this.cdr.detectChanges();
      this.toastTimer = setTimeout(() => {
        this.zone.run(() => { this.toastMeeting = null; this.cdr.detectChanges(); });
      }, 6000);
    });
  }

  dismissToast() {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.zone.run(() => { this.toastMeeting = null; this.cdr.detectChanges(); });
  }

  private handleEmployeeShowPanel() {
    this.zone.run(() => {
      this.showMeetingPanel = true;
      this.loadData(true);
      this.cdr.detectChanges();
    });
  }

  private checkStoredEmployeeShowPanel() {
    try {
      const raw = localStorage.getItem(this.employeeShowPanelActionKey);
      if (!raw) return;
      const payload = JSON.parse(raw);
      if (payload?.action === 'open') {
        const eventTime = new Date(payload.ts).getTime();
        if (!isNaN(eventTime) && Date.now() - eventTime < 20000) {
          this.handleEmployeeShowPanel();
        }
      }
    } catch {
      // ignore invalid payload
    }
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

  isPastMeeting(dateStr: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const meetingDate = new Date(dateStr);
    meetingDate.setHours(0, 0, 0, 0);
    return meetingDate < today;
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
