import { Component, OnInit, PLATFORM_ID, Inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-employee-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './employee.component.html',
  styleUrls: ['./employee.component.css']
})
export class EmployeeComponent implements OnInit {
  showSidebar = false;
  user: any = null;

  constructor(
    private api: ApiService, 
    private router: Router, 
    @Inject(PLATFORM_ID) private platformId: Object,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) {}

  openMeetingNotifications() {
    if (typeof window === 'undefined') return;

    const dispatchShowPanel = () => {
      window.dispatchEvent(new CustomEvent('employee-show-meeting-panel'));
      try {
        localStorage.setItem('employee-show-meeting-panel', JSON.stringify({ ts: new Date().toISOString(), action: 'open' }));
      } catch {
        // ignore storage errors
      }
    };

    const isDashboardActive = this.router.url.includes('/employee/dashboard');
    if (isDashboardActive) {
      dispatchShowPanel();
      return;
    }

    this.router.navigate(['/employee/dashboard']).then((navigated) => {
      if (navigated) {
        setTimeout(dispatchShowPanel, 120);
      } else {
        dispatchShowPanel();
      }
    }).catch(() => {
      dispatchShowPanel();
    });
  }

  ngOnInit() {
    // Avoid NG0100 error by wrapping the async load in a microtask/setTimeout
    setTimeout(() => {
      this.api.getMe().subscribe({
        next: (r: any) => { 
          this.zone.run(() => {
            this.user = r; 
            this.cdr.detectChanges();
          });
        },
        error: () => {}
      });
    }, 0);
  }

  logout() {
    const isAdmin = localStorage.getItem('role') === 'admin';
    
    const finalizeLogout = () => {
      if (isPlatformBrowser(this.platformId)) {
        localStorage.clear();
        window.location.href = '/login';
      } else {
        localStorage.clear();
        this.router.navigate(['/login']);
      }
    };

    if (isAdmin) {
      finalizeLogout();
    } else {
      this.api.endAttendance().subscribe({
        next: finalizeLogout,
        error: finalizeLogout
      });
    }
  }
}
