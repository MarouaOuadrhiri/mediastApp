import { Component, OnInit, ChangeDetectorRef, NgZone, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  stats = { employees: 0, projects: 0, departments: 0, tasks: 0, completedProjects: 0, activeProjects: 0 };
  projects: any[] = [];
  recentTasks: any[] = [];
  teamPerformance: any[] = [];
  user: any = null;
  loading = true;
  today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  globalStats = { completed: 0, inProgress: 0, pending: 0 };
  overallVelocity = 0;
  weeklyActivity: any[] = [
    { day: 'MON', value: 0 }, { day: 'TUE', value: 0 }, { day: 'WED', value: 0 },
    { day: 'THU', value: 0 }, { day: 'FRI', value: 0 }, { day: 'SAT', value: 0 }, { day: 'SUN', value: 0 }
  ];

  timerValue = '00:00:00';
  timerRunning = false;
  private timerInterval: any;
  private teamTimerInterval: any;
  private refreshInterval: any;

  // Meeting Modal State
  showMeetingModal = false;
  isSubmittingMeeting = false;
  meetingForm = {
    title: '',
    description: '',
    date: '',
    time: '',
    allDepartments: false,
    selectedDepartments: [] as string[],
    selectedEmployees: [] as string[]
  };
  allDepartments: any[] = [];
  allEmployees: any[] = [];
  filteredEmployees: any[] = [];

  constructor(
    private api: ApiService, 
    private cdr: ChangeDetectorRef, 
    private zone: NgZone,
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
    if (this.teamTimerInterval) clearInterval(this.teamTimerInterval);
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }

  openMeetingModal() {
    this.showMeetingModal = true;
    this.isSubmittingMeeting = false;
    this.meetingForm = {
      title: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      time: '10:00',
      allDepartments: false,
      selectedDepartments: [],
      selectedEmployees: []
    };
    // Reset filtered employees without calling onDepartmentChange (no dept selected yet)
    this.filteredEmployees = [];
  }

  closeMeetingModal() {
    if (this.isSubmittingMeeting) return; // Don't close while submitting
    this.showMeetingModal = false;
    this.isSubmittingMeeting = false;
  }

  onDepartmentChange() {
    if (this.meetingForm.allDepartments) {
      this.filteredEmployees = [...this.allEmployees];
    } else if (this.meetingForm.selectedDepartments.length > 0) {
      this.filteredEmployees = this.allEmployees.filter(e =>
        this.meetingForm.selectedDepartments.includes(e.department_id)
      );
    } else {
      this.filteredEmployees = [];
    }
    // Clear selected employees that are no longer in filtered list
    const filteredIds = new Set(this.filteredEmployees.map(e => e.id));
    this.meetingForm.selectedEmployees = this.meetingForm.selectedEmployees.filter(id => filteredIds.has(id));
  }

  toggleDepartment(id: string) {
    const idx = this.meetingForm.selectedDepartments.indexOf(id);
    if (idx > -1) this.meetingForm.selectedDepartments.splice(idx, 1);
    else this.meetingForm.selectedDepartments.push(id);
    this.onDepartmentChange();
  }

  toggleEmployee(id: string) {
    const idx = this.meetingForm.selectedEmployees.indexOf(id);
    if (idx > -1) this.meetingForm.selectedEmployees.splice(idx, 1);
    else this.meetingForm.selectedEmployees.push(id);
  }

  submitMeeting() {
    const title = (this.meetingForm.title || '').trim();
    const date  = (this.meetingForm.date  || '').trim();
    const time  = (this.meetingForm.time  || '').trim();

    if (!title) { alert('Please enter a meeting title.'); return; }
    if (!date)  { alert('Please select a date.'); return; }
    if (!time)  { alert('Please select a time.'); return; }

    const hasParticipants =
      this.meetingForm.allDepartments ||
      this.meetingForm.selectedDepartments.length > 0 ||
      this.meetingForm.selectedEmployees.length > 0;

    if (!hasParticipants) {
      alert('Please select at least one department or employee as a participant.');
      return;
    }

    this.isSubmittingMeeting = true;

    const meetingData = {
      title,
      description: (this.meetingForm.description || '').trim(),
      date_time: `${date}T${time}:00Z`,
      departments: this.meetingForm.allDepartments
        ? this.allDepartments.map(d => d.id)
        : this.meetingForm.selectedDepartments,
      employees: this.meetingForm.selectedEmployees
    };

    this.api.createMeeting(meetingData).subscribe({
      next: () => {
        this.isSubmittingMeeting = false;
        this.showMeetingModal = false;
        alert('Meeting scheduled successfully!');
      },
      error: (err) => {
        this.isSubmittingMeeting = false;
        const msg = err.error?.error || err.message || 'Unknown error';
        alert('Could not schedule meeting: ' + msg);
      }
    });
  }

  loadData(isRefresh = false) {
    if (!isRefresh) {
      setTimeout(() => {
        this.loading = true;
        if (isPlatformBrowser(this.platformId)) {
          this.cdr.detectChanges();
        }
      }, 0);
    }

    this.api.getProjects().subscribe({
      next: (r: any) => {
        const runLogic = () => {
          this.projects = r;
          this.stats.projects = r.length;
          const allTasks: any[] = [];
          let doneProjects = 0;
          let activeProjects = 0;
          
          r.forEach((p: any) => { 
            if (p.tasks) allTasks.push(...p.tasks); 
            const prog = this.getProjectProgress(p);
            if (prog === 100 && p.tasks && p.tasks.length > 0) doneProjects++;
            else activeProjects++;
          });

          this.stats.completedProjects = doneProjects;
          this.stats.activeProjects = activeProjects;
          this.recentTasks = allTasks.slice(0, 6);
          this.stats.tasks = allTasks.filter((t: any) => t.status !== 'DONE').length;

          const comp = allTasks.filter(t => t.status === 'DONE').length;
          const prog = allTasks.filter(t => t.status === 'IN_PROGRESS').length;
          const todo = allTasks.filter(t => t.status === 'TODO').length;
          
          if (allTasks.length > 0) {
            this.globalStats = { completed: comp, inProgress: prog, pending: todo };
            this.overallVelocity = Math.round((comp / allTasks.length) * 100);
          }

          this.updateWeeklyActivity(allTasks);
          this.loading = false;
          this.cdr.detectChanges();
        };

        if (this.zone) this.zone.run(runLogic);
        else runLogic();
      },
      error: () => { 
        if (this.zone) this.zone.run(() => { this.loading = false; this.cdr.detectChanges(); }); 
        else { this.loading = false; this.cdr.detectChanges(); }
      }
    });

    this.api.getEmployees().subscribe({
      next: (r: any) => { 
        const runLogic = () => {
          this.allEmployees = r; // Store all for selecting in modal
          this.stats.employees = r.length; 
          this.teamPerformance = r.slice(0, 4).map((e: any, idx: number) => ({
            name: e.username,
            role: e.department_name || (idx === 0 ? 'Videographer' : 'Senior Dev'),
            status: e.is_online ? 'ONLINE' : 'OFFLINE',
            photo: e.profile_photo || null,
            isOnline: e.is_online,
            sessionStart: e.current_session_start,
            totalWorkToday: e.total_work_today,
            elapsed: e.is_online ? '00:00:00' : e.total_work_today
          }));
          this.startTeamTimer();
          this.cdr.detectChanges();
        };
        if (this.zone) this.zone.run(runLogic);
        else runLogic();
      },
      error: () => {}
    });

    if (!isRefresh) {
      this.api.getMe().subscribe({
        next: (r: any) => { 
          const runLogic = () => {
            this.user = r; 
            this.api.getCurrentAttendance().subscribe(session => {
              if (session) {
                this.timerRunning = true;
                this.startTimer(session.start_time);
              }
              this.cdr.detectChanges();
            });
            this.cdr.detectChanges();
          };
          if (this.zone) this.zone.run(runLogic);
          else runLogic();
        },
        error: () => {}
      });

      this.api.getDepartments().subscribe({
        next: (r: any) => { 
          const logic = () => {
             this.allDepartments = r; // Store all for selecting in modal
             this.stats.departments = r.length; 
             this.cdr.detectChanges();
          };
          if (this.zone) this.zone.run(logic); 
          else logic();
        },
        error: () => {}
      });
    }
  }

  getProjectProgress(p: any): number {
    if (!p || !p.tasks || p.tasks.length === 0) return 0;
    const done = p.tasks.filter((t: any) => t.status === 'DONE').length;
    return Math.round((done / p.tasks.length) * 100);
  }

  updateWeeklyActivity(allTasks: any[]) {
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const now = new Date();
    const activityMap: { [key: string]: number } = {
      'MON': 0, 'TUE': 0, 'WED': 0, 'THU': 0, 'FRI': 0, 'SAT': 0, 'SUN': 0
    };

    const monday = new Date(now);
    monday.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
    monday.setHours(0, 0, 0, 0);

    allTasks.forEach(t => {
      if (t.status === 'DONE') {
        const compDate = t.completed_at ? new Date(t.completed_at) : new Date();
        if (compDate >= monday) {
          const dayName = days[compDate.getDay()];
          activityMap[dayName] = (activityMap[dayName] || 0) + 20;
        }
      }
    });

    this.weeklyActivity = [
      { day: 'MON', value: Math.min(activityMap['MON'], 100) },
      { day: 'TUE', value: Math.min(activityMap['TUE'], 100) },
      { day: 'WED', value: Math.min(activityMap['WED'], 100) },
      { day: 'THU', value: Math.min(activityMap['THU'], 100) },
      { day: 'FRI', value: Math.min(activityMap['FRI'], 100) },
      { day: 'SAT', value: Math.min(activityMap['SAT'], 100) },
      { day: 'SUN', value: Math.min(activityMap['SUN'], 100) }
    ];
  }

  startTeamTimer() {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.teamTimerInterval) clearInterval(this.teamTimerInterval);
    if (!this.zone) return;
    
    this.zone.runOutsideAngular(() => {
      this.teamTimerInterval = setInterval(() => {
        const now = new Date().getTime();
        this.zone.run(() => {
          this.teamPerformance.forEach(m => {
            if (m.isOnline && m.sessionStart) {
              const start = new Date(m.sessionStart).getTime();
              const diff = now - start;
              const h = Math.floor(diff / 3600000);
              const m_ = Math.floor((diff % 3600000) / 60000);
              const s = Math.floor((diff % 60000) / 1000);
              m.elapsed = `${this.pad(h)}:${this.pad(m_)}:${this.pad(s)}`;
            } else {
              m.elapsed = m.totalWorkToday;
            }
          });
          this.cdr.detectChanges();
        });
      }, 1000);
    });
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
        const m_ = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        this.zone.run(() => {
          this.timerValue = `${this.pad(h)}:${this.pad(m_)}:${this.pad(s)}`;
          this.cdr.detectChanges();
        });
      }, 1000);
    });
  }

  private pad(n: number): string {
    return n < 10 ? '0' + n : '' + n;
  }

  toggleTimer() {
    this.timerRunning = !this.timerRunning;
  }

  stopTimer() {
    this.api.endAttendance().subscribe(() => {
      const runLogic = () => {
        this.timerRunning = false;
        this.timerValue = '00:00:00';
        this.cdr.detectChanges();
      };
      if (this.zone) this.zone.run(runLogic);
      else runLogic();
    });
  }

  getInitials(name: string): string {
    return name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : '??';
  }
}
