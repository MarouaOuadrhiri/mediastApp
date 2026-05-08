import { Component, OnInit, OnDestroy, PLATFORM_ID, Inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { UiService } from '../../core/ui.service';
import { ProjectModalComponent } from './projects/project-modal.component';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, ProjectModalComponent],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit, OnDestroy {
  showSidebar = true;
  user: any = null;
  showUserDropdown = false;

  toggleUserDropdown() {
    this.showUserDropdown = !this.showUserDropdown;
  }

  // Meetings notification state
  meetings: any[] = [];
  upcomingMeetings: any[] = [];
  showNotifPanel = false;
  newMeetingCount = 0;
  // Popup toast for newly detected meetings
  toastMeeting: any = null;
  private toastTimer: any;
  private meetingPollInterval: any;
  private meetingCreatedListener: any;
  private lastSeenMeetingIds: Set<string> = new Set();
  systemNotifications: any[] = [];
  refusalRequests: any[] = [];
  private refusalPollInterval: any;

  constructor(
    private api: ApiService,
    private ui: UiService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) { }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        this.api.getMe().subscribe({
          next: (r: any) => {
            this.zone.run(() => { 
              this.user = r; 
              this.cdr.markForCheck(); 
              this.checkSystemStatus(); // Run automated checks on launch
            });
          },
          error: () => { }
        });
        this.loadMeetings(true); // initial load — mark all existing as "seen"
        this.loadRefusalRequests();
      }, 0);

      // Poll for new meetings every 30s
      this.meetingPollInterval = setInterval(() => this.loadMeetings(false), 30000);
      this.refusalPollInterval = setInterval(() => this.loadRefusalRequests(), 30000);

      this.meetingCreatedListener = (event: any) => {
        const meeting = event?.detail;
        if (meeting && meeting.title) {
          this.loadMeetings(false);
          this.showToast(meeting);
        }
      };
      window.addEventListener('meeting-created', this.meetingCreatedListener);
    }

    // Subscribe to system-wide notifications
    this.ui.notifications$.subscribe(n => {
      this.systemNotifications.unshift(n);
      if (this.systemNotifications.length > 10) this.systemNotifications.pop();
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy() {
    if (this.meetingPollInterval) clearInterval(this.meetingPollInterval);
    if (this.refusalPollInterval) clearInterval(this.refusalPollInterval);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    if (this.meetingCreatedListener) window.removeEventListener('meeting-created', this.meetingCreatedListener);
  }

  loadRefusalRequests() {
    // 1. Fetch standalone tasks
    this.api.getTasks().subscribe({
      next: (r: any) => {
        const tasks: any[] = r || [];
        const standaloneRefusals = tasks.filter(t => t.refusal_pending);
        
        // 2. Fetch projects to find project-only tasks with refusal_pending
        this.api.getProjects().subscribe({
          next: (projects: any[]) => {
            const projectRefusals: any[] = [];
            projects.forEach(p => {
              if (p.tasks) {
                p.tasks.forEach((t: any) => {
                  if (t.refusal_pending) {
                    // Check if we already have this refusal via standalone (source_project_task_id)
                    const isAlreadyCounted = standaloneRefusals.some(s => s.source_project_task_id === t.id);
                    if (!isAlreadyCounted) {
                      projectRefusals.push({
                        ...t,
                        project_id: p.id,
                        project_name: p.name,
                        is_project_task: true
                      });
                    }
                  }
                });
              }
            });
            
            this.refusalRequests = [...standaloneRefusals, ...projectRefusals];
            this.cdr.markForCheck();
          }
        });
      }
    });
  }

  approveRefusal(task: any) {
    if (task.is_project_task) {
      this.router.navigate(['/admin/projects'], { queryParams: { id: task.project_id, editTask: task.id } });
    } else {
      this.router.navigate(['/admin/tasks'], { queryParams: { edit: task.id } });
    }
  }

  rejectRefusal(task: any) {
    const obs = task.is_project_task
      ? this.api.updateProjectTaskStatus(task.project_id, task.id, 'IN_PROGRESS', '', false)
      : this.api.updateTaskStatus(task.id, 'IN_PROGRESS', false, '', false);
    
    obs.subscribe({
      next: () => {
        this.ui.notify('Refus décliné. La tâche est remise en cours.', 'info');
        this.loadRefusalRequests();
      }
    });
  }

  loadMeetings(isInitial = false) {
    this.api.getMeetings().subscribe({
      next: (r: any) => {
        this.zone.run(() => {
          const raw: any[] = r || [];
          const now = new Date();

          this.meetings = raw;
          this.upcomingMeetings = raw
            .filter(m => (m.status === 'TODO' || !m.status) && new Date(m.date_time) >= now)
            .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());

          const in24h = new Date(now.getTime() + 24 * 3600 * 1000);
          this.newMeetingCount = this.upcomingMeetings.filter(m => new Date(m.date_time) <= in24h).length;

          if (isInitial) {
            // Seed seen IDs — don't toast on first load
            raw.forEach(m => this.lastSeenMeetingIds.add(m.id));
          } else {
            // Detect brand-new meetings
            const newOnes = raw.filter(m => !this.lastSeenMeetingIds.has(m.id));
            raw.forEach(m => this.lastSeenMeetingIds.add(m.id));
            if (newOnes.length > 0) {
              this.showToast(newOnes[newOnes.length - 1]); // show the latest
            }
          }
          this.cdr.markForCheck();
        });
      },
      error: () => { }
    });
  }

  showToast(meeting: any) {
    this.zone.run(() => {
      if (this.toastTimer) clearTimeout(this.toastTimer);
      this.toastMeeting = meeting;
      this.cdr.markForCheck();
      this.toastTimer = setTimeout(() => {
        this.zone.run(() => { this.toastMeeting = null; this.cdr.markForCheck(); });
      }, 6000);
    });
  }

  dismissToast() {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.zone.run(() => { this.toastMeeting = null; this.cdr.markForCheck(); });
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

    const isAdmin = isPlatformBrowser(this.platformId) && localStorage.getItem('role') === 'admin';
    if (isAdmin) {
      finalizeLogout();
    } else {
      this.api.endAttendance().subscribe({ next: finalizeLogout, error: finalizeLogout });
    }
  }

  closeSidebar() {
    this.showSidebar = false;
  }

  toggleSidebar() {
    this.showSidebar = !this.showSidebar;
  }

  onNewProjectClick() {
    this.ui.triggerOpenProjectModal();
  }

  toggleMeetingStatus(m: any) {
    const newStatus = m.status === 'DONE' ? 'TODO' : 'DONE';
    this.api.updateMeetingStatus(m.id, newStatus).subscribe({
      next: () => {
        this.loadMeetings(false);
      }
    });
  }

  /**
   * Automated System Audit: Runs on launch to populate notifications based on preferences.
   */
  checkSystemStatus() {
    const prefs = this.user?.preferences;
    if (!prefs) return;

    // 1. Check Project Milestones
    if (prefs.project_milestones) {
      this.api.getProjects().subscribe(projects => {
        const critical = projects.filter((p: any) => {
          const total = p.tasks?.length || 0;
          const done = p.tasks?.filter((t: any) => t.status === 'DONE').length || 0;
          const progress = total > 0 ? (done / total) * 100 : 0;
          return progress >= 80 && progress < 100;
        });
        critical.forEach((p: any) => {
          this.ui.notify(`CRITICAL PATH: "${p.name}" est à ${Math.round((p.tasks?.filter((t: any) => t.status === 'DONE').length / p.tasks?.length) * 100)}%`, 'success', 'Project Milestones');
        });
      });
    }

    // 2. Run Velocity Audit
    if (prefs.daily_velocity_report) {
      this.api.getTasks().subscribe(tasks => {
        const overdue = tasks.filter((t: any) => t.status !== 'DONE' && new Date(t.deadline) < new Date()).length;
        this.ui.notify(`Analyse : ${overdue} tâches sont actuellement en retard.`, 'warn', 'Daily Velocity');
      });
    }

    // 3. Simulate Mention if active
    if (prefs.mention_alerts) {
      this.api.getEmployees().subscribe(users => {
        if (users && users.length > 0) {
          const randomUser = users[users.length - 1]; // Pick a real one
          this.ui.notify(`${randomUser.first_name} ${randomUser.last_name} a mentionné votre profil.`, 'info', 'Mention Alerts');
        }
      });
    }
  }
}
