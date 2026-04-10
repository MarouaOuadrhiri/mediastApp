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

  constructor(
    private api: ApiService,
    private ui: UiService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) {}

  ngOnInit() {
    setTimeout(() => {
      this.api.getMe().subscribe({
        next: (r: any) => {
          this.zone.run(() => { this.user = r; this.cdr.detectChanges(); });
        },
        error: () => {}
      });
      this.loadMeetings(true); // initial load — mark all existing as "seen"
    }, 0);

    if (isPlatformBrowser(this.platformId)) {
      // Poll for new meetings every 30s
      this.meetingPollInterval = setInterval(() => this.loadMeetings(false), 30000);

      this.meetingCreatedListener = (event: any) => {
        const meeting = event?.detail;
        if (meeting && meeting.title) {
          this.loadMeetings(false);
          this.showToast(meeting);
        }
      };
      window.addEventListener('meeting-created', this.meetingCreatedListener);
    }
  }

  ngOnDestroy() {
    if (this.meetingPollInterval) clearInterval(this.meetingPollInterval);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    if (this.meetingCreatedListener) window.removeEventListener('meeting-created', this.meetingCreatedListener);
  }

  loadMeetings(isInitial = false) {
    this.api.getMeetings().subscribe({
      next: (r: any) => {
        this.zone.run(() => {
          const raw: any[] = r || [];
          const now = new Date();

          this.meetings = raw;
          this.upcomingMeetings = raw
            .filter(m => new Date(m.date_time) >= now)
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
          this.cdr.detectChanges();
        });
      },
      error: () => {}
    });
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
}
