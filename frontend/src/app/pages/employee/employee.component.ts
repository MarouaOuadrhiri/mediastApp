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
