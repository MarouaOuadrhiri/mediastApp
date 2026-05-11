import { Component, OnInit, ChangeDetectorRef, NgZone, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { ApiService } from '../../../core/api.service';
import { UiService } from '../../../core/ui.service';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-employee-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DragDropModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  projects: any[] = [];
  standaloneTasks: any[] = [];
  todoTasks: any[] = [];
  inProgressTasks: any[] = [];
  reviewTasks: any[] = [];
  doneTasks: any[] = [];
  meetings: any[] = [];
  upcomingMeetings: any[] = [];
  newMeetingCount = 0;
  showMeetingPanel = false;
  selectedProject: any = null;
  toastMeeting: any = null;
  systemNotifications: any[] = [];
  private notificationStorageKey = 'employee_system_notifications';
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
  isDragging = false;
  isUpdating = false;
  timerRunning = false;
  timerValue = '00:00:00';
  isLunchBreak = false;
  lunchBreakOver = false;
  lunchSecondsLeft = 3600;
  sessionStartTime: string | null = null;

  constructor(
    private api: ApiService,
    private ui: UiService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit() {
    this.loadSeenMeetingIds();
    if (isPlatformBrowser(this.platformId)) {
      this.loadStoredNotifications();
      this.ui.notifications$.subscribe((n: any) => {
        this.systemNotifications.unshift(n);
        if (this.systemNotifications.length > 10) this.systemNotifications.pop();
        this.saveNotifications();
        this.cdr.detectChanges();
      });

      this.loadData();

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
      this.restoreTimerState();
      this.ui.notifications$.subscribe((n: any) => {
        this.systemNotifications.unshift(n);
        if (this.systemNotifications.length > 10) this.systemNotifications.pop();
        this.cdr.detectChanges();
      });
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
    if (isPlatformBrowser(this.platformId)) {
      const raw = localStorage.getItem(this.meetingSeenStorageKey);
      if (raw) {
        try {
          const ids = JSON.parse(raw);
          if (Array.isArray(ids)) this.lastSeenMeetingIds = new Set(ids);
        } catch (e) { }
      }
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
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.isDragging || this.isUpdating) return;
    this.api.getMyProjects().subscribe({
      next: (r: any) => {
        if (this.isDragging || this.isUpdating) return;
        this.runInZone(() => { 
          this.projects = r || []; 
          
          // Initialize selectedProject to "My Tasks" if nothing selected
          if (!this.selectedProject) {
            this.selectedProject = { id: 'general', name: 'My Tasks' };
          }
          
          this.updateTaskLists(); 
          this.cdr.detectChanges(); 
        });
      },
      error: () => { if (!isRefresh) this.errorMsg = 'Failed to load project data.'; }
    });

    this.api.getTasks().subscribe({
      next: (r: any) => {
        if (this.isDragging || this.isUpdating) return;
        this.runInZone(() => { this.standaloneTasks = r || []; this.updateTaskLists(); this.cdr.detectChanges(); });
      },
      error: () => { if (!isRefresh) this.errorMsg = 'Failed to load tasks.'; }
    });

    this.api.getMeetings().subscribe({
      next: (r: any) => {
        if (this.isDragging || this.isUpdating) return;
        this.runInZone(() => { this.processMeetings(r || [], isRefresh); this.cdr.detectChanges(); });
      },
      error: () => { }
    });

    if (!isRefresh) {
      this.api.getMe().subscribe({
        next: (r: any) => {
          if (this.isDragging || this.isUpdating) return;
          this.runInZone(() => {
            this.user = r;
            this.checkSystemStatus(); // Run automated checks on launch
            this.cdr.detectChanges();
          });
        },
        error: () => { }
      });

      this.api.getCurrentAttendance().subscribe({
        next: (session: any) => {
          if (this.isDragging || this.isUpdating) return;
          this.runInZone(() => {
            if (session && session.start_time) {
              this.attendanceSession = session;
              this.timerRunning = true;
              this.startTimer(session.start_time);
            } else if (!this.isLunchBreak) {
              this.attendanceSession = null;
              this.timerRunning = false;
              this.timerValue = '00:00:00';
              this.elapsedTime = '00:00:00';
            }
            this.cdr.detectChanges();
          });
        },
        error: () => { }
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
      // On first load, don't toast everything, but toast meetings created in the last 5 minutes
      const now = new Date().getTime();
      const veryRecent = raw.filter(m => {
        if (!m.created_at) return false;
        const created = new Date(m.created_at).getTime();
        return (now - created) < 300000; // 5 minutes
      });

      raw.forEach(m => { if (m.id) this.lastSeenMeetingIds.add(m.id); });
      this.saveSeenMeetingIds();

      if (veryRecent.length > 0) {
        this.showToast(veryRecent[veryRecent.length - 1]);
      }
    }
  }

  /**
   * Automated System Audit: Runs on launch to populate notifications based on preferences.
   */
  checkSystemStatus() {
    const prefs = this.user?.preferences;
    if (!prefs) return;

    // 1. Check Project Milestones
    if (prefs.project_milestones) {
      this.api.getMyProjects().subscribe(projects => {
        const critical = projects.filter((p: any) => {
          const total = p.tasks?.length || 0;
          const done = p.tasks?.filter((t: any) => t.status === 'DONE').length || 0;
          const progress = total > 0 ? (done / total) * 100 : 0;
          return progress >= 80 && progress < 100;
        });
        critical.forEach((p: any) => {
          this.ui.notify(`CRITICAL PATH: "${p.name}" is at ${Math.round((p.tasks?.filter((t: any) => t.status === 'DONE').length / p.tasks?.length) * 100)}%`, 'success', 'Project Milestones');
        });
      });
    }

    // 2. Run Velocity Audit
    if (prefs.daily_velocity_report) {
      this.api.getTasks().subscribe(tasks => {
        const overdue = tasks.filter((t: any) => t.status !== 'DONE' && t.deadline && new Date(t.deadline) < new Date()).length;
        if (overdue > 0) {
          this.ui.notify(`Velocity Audit: ${overdue} tasks are currently overdue.`, 'warn', 'Daily Velocity');
        }
      });
    }

    // 3. Simulate Mention if active
    if (prefs.mention_alerts) {
      // Pick a random recently active coworker or system message
      this.ui.notify(`You were mentioned in the "BrandShift Redesign" discussion.`, 'info', 'Mention Alerts');
    }
  }

  private loadStoredNotifications() {
    if (!isPlatformBrowser(this.platformId)) return;
    const raw = localStorage.getItem(this.notificationStorageKey);
    if (raw) {
      try {
        this.systemNotifications = JSON.parse(raw);
      } catch (e) { }
    }
  }

  private saveNotifications() {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(this.notificationStorageKey, JSON.stringify(this.systemNotifications));
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
    if (isPlatformBrowser(this.platformId)) {
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
      } catch (e) { }
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

  viewMode: 'kanban' | 'list' = 'kanban';
  listStatuses = ['TODO', 'IN PROGRESS', 'REVIEW', 'DONE'];
  expandedStatusGroups: Set<string> = new Set(['TODO', 'IN PROGRESS', 'REVIEW', 'DONE']);

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

  private updateTimeout: any;

  private restoreTimerState() {
    if (isPlatformBrowser(this.platformId)) {
      const sessionType = localStorage.getItem('employee_timer_mode');
      const startTime = localStorage.getItem('employee_timer_start');
      if (sessionType === 'LUNCH' && startTime) {
        this.isLunchBreak = true;
        this.timerRunning = false;
        const startTs = parseInt(startTime);
        const elapsed = Math.floor((Date.now() - startTs) / 1000);
        this.lunchSecondsLeft = Math.max(0, 3600 - elapsed);
        if (this.lunchSecondsLeft === 0) {
          this.lunchBreakOver = true;
          this.timerValue = 'LUNCH OVER';
        }
        this.startTimer(new Date().toISOString()); // start timer loop to handle lunch
      }
    }
  }

  startTimer(startTime: string) {
    if (!isPlatformBrowser(this.platformId)) return;
    this.sessionStartTime = startTime;
    if (!this.isLunchBreak) this.timerRunning = true;

    if (this.timerInterval) clearInterval(this.timerInterval);
    if (!this.zone) return;

    this.zone.runOutsideAngular(() => {
      this.timerInterval = setInterval(() => {
        const nowTs = new Date().getTime();

        if (this.isLunchBreak) {
          const lunchStart = localStorage.getItem('employee_timer_start');
          if (lunchStart) {
            const startTs = parseInt(lunchStart);
            const elapsed = Math.floor((nowTs - startTs) / 1000);
            this.lunchSecondsLeft = Math.max(0, 3600 - elapsed);
            if (this.lunchSecondsLeft > 0) {
              const m = Math.floor(this.lunchSecondsLeft / 60);
              const s = this.lunchSecondsLeft % 60;
              this.zone.run(() => {
                this.timerValue = `LUNCH ${this.pad(m)}:${this.pad(s)}`;
                this.elapsedTime = this.timerValue;
                this.cdr.detectChanges();
              });
            } else {
              this.zone.run(() => {
                this.lunchBreakOver = true;
                this.timerValue = 'LUNCH OVER';
                this.elapsedTime = this.timerValue;
                this.cdr.detectChanges();
              });
            }
          }
        } else if (this.timerRunning && this.sessionStartTime) {
          const start = new Date(this.sessionStartTime).getTime();
          let prevSecs = 0;
          if (this.user && this.user.total_work_today) {
            const parts = this.user.total_work_today.split(':');
            if (parts.length === 3) prevSecs = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
          }
          const diff = (nowTs - start) + (prevSecs * 1000);
          const h = Math.floor(diff / 3600000);
          const m = Math.floor((diff % 3600000) / 60000);
          const s = Math.floor((diff % 60000) / 1000);

          this.zone.run(() => {
            this.elapsedTime = `${this.pad(h)}:${this.pad(m)}:${this.pad(s)}`;
            this.timerValue = this.elapsedTime;
            this.cdr.detectChanges();
          });
        }
      }, 1000);
    });
  }

  toggleTimer() {
    if (this.isLunchBreak) {
      this.isLunchBreak = false;
      this.lunchBreakOver = false;
      localStorage.removeItem('employee_timer_mode');
      localStorage.removeItem('employee_timer_start');
      this.timerValue = '00:00:00';
      this.elapsedTime = '00:00:00';
    }

    if (this.timerRunning) {
      this.api.endAttendance().subscribe(() => {
        this.timerRunning = false;
        this.sessionStartTime = null;
        this.attendanceSession = null;
        this.timerValue = '00:00:00';
        this.elapsedTime = '00:00:00';
        this.loadData();
      });
    } else {
      this.api.startAttendance().subscribe(() => {
        this.timerRunning = true;
        this.sessionStartTime = new Date().toISOString();
        this.loadData();
      });
    }
  }

  startLunchBreak() {
    if (this.isLunchBreak) return;
    if (this.timerRunning) {
      this.api.endAttendance().subscribe(() => {
        const startTs = Date.now();
        localStorage.setItem('employee_timer_mode', 'LUNCH');
        localStorage.setItem('employee_timer_start', startTs.toString());
        this.timerRunning = false;
        this.isLunchBreak = true;
        this.startTimer(new Date().toISOString());
        this.loadData();
      });
    } else {
      const startTs = Date.now();
      localStorage.setItem('employee_timer_mode', 'LUNCH');
      localStorage.setItem('employee_timer_start', startTs.toString());
      this.isLunchBreak = true;
      this.startTimer(new Date().toISOString());
    }
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

    let isAdmin = false;
    if (isPlatformBrowser(this.platformId)) {
      isAdmin = localStorage.getItem('role') === 'ADMIN';
    }

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
      next: () => {
        this.runInZone(() => { this.cdr.detectChanges(); });
      },
      error: () => {
        this.runInZone(() => {
          this.errorMsg = 'Failed to update task status.';
          this.isUpdating = false;
          this.loadData(); // Revert UI on error
          this.cdr.detectChanges();
        });
      }
    });
  }

  trackById(index: number, item: any): string {
    return item.id || index.toString();
  }

  getTotalActiveTasks(): number {
    return this.getAllTasks().filter(t => t.status !== 'DONE').length;
  }

  getOverallProgress(): number {
    const all = this.getAllTasks();
    if (all.length === 0) return 0;
    const done = all.filter(t => t.status === 'DONE').length;
    return Math.round((done / all.length) * 100);
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

  getTotalTasks(): number {
    return this.getAllTasks().length;
  }

  getCompletedTasks(): number {
    return this.getAllTasks().filter(t => t.status === 'DONE').length;
  }

  getProgressByStatus(status: string): number {
    switch (status) {
      case 'DONE': return 100;
      case 'REVIEW': return 90;
      case 'IN_PROGRESS': return 50;
      default: return 0;
    }
  }

  isUrgent(task: any): boolean {
    if (!task.deadline) return false;
    const deadline = new Date(task.deadline);
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days <= 2;
  }

  getProductivityScore(): number {
    return this.getCompletedTasks() * 4; // Arbitrary calculation for UI
  }

  private parseId(id: any): string | null {
    if (!id || id === 'null' || id === 'undefined') return null;
    if (typeof id === 'object') return id.$oid || id.toString();
    const str = id.toString();
    return (str === 'null' || str === 'undefined') ? null : str;
  }

  getAllTasks(): any[] {
    const all: any[] = [];

    // Add standalone tasks with project context
    this.standaloneTasks.forEach(t => {
      let projectName = t.project_name || 'General';
      const tProjId = this.parseId(t.project_id);
      if (tProjId) {
        const p = this.projects.find(proj => this.parseId(proj.id) === tProjId);
        if (p) projectName = p.name;
      }
      all.push({ ...t, project_name: projectName, is_project_task: false });
    });

    return all;
  }

  getTasksByStatus(status: string): any[] {
    if (status === 'TODO') {
      return this.getAllTasks().filter(t => t.status === 'TODO' || t.status === 'BLOCKED');
    }
    return this.getAllTasks().filter(t => t.status === status);
  }

  updateTaskLists() {
    let all: any[] = [];
    
    // Filter by selected project if one is active
    if (this.selectedProject) {
      if (this.selectedProject.id === 'general') {
        // "MY TASKS" tab shows all standalone tasks
        all = this.standaloneTasks.map(t => ({ ...t, is_project_task: false }));
      } else {
        // Project tabs show tasks from the Project model (embedded tasks)
        if (this.selectedProject.tasks) {
          all = this.selectedProject.tasks.map((pt: any) => ({
            ...pt,
            project_id: this.selectedProject.id,
            project_name: this.selectedProject.name,
            is_project_task: true
          }));
        }
      }
    }

    this.todoTasks = all.filter(t => {
      const s = (t.status || '').toUpperCase();
      return s === 'TODO' || s === 'BLOCKED';
    });
    this.inProgressTasks = all.filter(t => (t.status || '').toUpperCase() === 'IN_PROGRESS');
    this.reviewTasks = all.filter(t => (t.status || '').toUpperCase() === 'REVIEW');
    this.doneTasks = all.filter(t => (t.status || '').toUpperCase() === 'DONE');
  }

  getCriticalProjects(): any[] {
    const list: any[] = [];
    
    // Always add a "My Tasks" (General) tab
    list.push({ id: 'general', name: 'My Tasks' });

    if (this.projects) {
      const sorted = [...this.projects]
        .sort((a, b) => {
          const dateA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
          const dateB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
          return dateA - dateB;
        })
        .slice(0, 3);
      list.push(...sorted);
    }
    
    return list;
  }

  selectProject(project: any) {
    this.selectedProject = project;
    this.updateTaskLists();
    this.cdr.detectChanges();
  }

  drop(event: CdkDragDrop<any[]>, targetStatus: string) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      const task = event.previousContainer.data[event.previousIndex];
      const apiStatus = targetStatus;

      // Optimistic UI Update: Move immediately
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
      task.status = apiStatus;
      
      this.isUpdating = true;

      const updateObs = task.is_project_task
        ? this.api.updateProjectTaskStatus(task.project_id, task.id, apiStatus)
        : this.api.updateTaskStatus(task.id, apiStatus);

      updateObs.subscribe({
        next: () => {
          this.isUpdating = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.isUpdating = false;
          this.loadData(); // Revert on error
          this.cdr.detectChanges();
        }
      });
    }
    this.isDragging = false;
    this.runInZone(() => { this.cdr.detectChanges(); });
  }

  onDragStarted() {
    this.isDragging = true;
  }

  getPriorityTasks(): any[] {
    return this.getAllTasks().filter(t => t.priority === 'high' || t.priority === 'medium' || !t.status || t.status !== 'DONE').sort((a, b) => {
      const pA = a.priority === 'high' ? 3 : (a.priority === 'medium' ? 2 : 1);
      const pB = b.priority === 'high' ? 3 : (b.priority === 'medium' ? 2 : 1);
      return pB - pA;
    });
  }

  getAvgResponseTime(): string {
    return '3.2h'; // Static for UI mock
  }

  getCurrentLoad(): number {
    return 68; // Static for UI mock
  }

  getProjectColor(name: string): string {
    const colors = ['#e53935', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa'];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }

  getProjectInitials(name: string): string {
    return name.substring(0, 2).toUpperCase();
  }

  getDaysLeftText(deadline: any): string {
    if (!deadline) return 'No Date';
    const now = new Date();
    const target = new Date(deadline);
    const diff = target.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (days < 0) return 'Overdue';
    if (days === 0) return 'Due Today';
    if (days === 1) return 'Tomorrow';
    return `${days} days left`;
  }

  getDeadlineClass(deadline: any): string {
    if (!deadline) return '';
    const now = new Date();
    const target = new Date(deadline);
    const diff = target.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (days <= 2) return 'urgent';
    if (days <= 5) return 'near';
    return '';
  }
}

