import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ApiService } from '../../../core/api.service';

@Component({
  selector: 'app-employee-calendar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.css']
})
export class CalendarComponent implements OnInit {
  currentDate = new Date();
  currentMonth = this.currentDate.getMonth();
  currentYear = this.currentDate.getFullYear();
  selectedDate: Date | null = null;
  weeks: (Date | null)[][] = [];

  /** Raw data from API */
  tasks: any[] = [];
  meetings: any[] = [];
  projects: any[] = [];   // items with start_date + end_date (or deadline)

  /** Right panel */
  upcomingDeadlines: any[] = [];
  reminders = [
    { text: 'Update timesheets for Q4', done: false },
    { text: 'Email client regarding revisions', done: false },
    { text: 'Review PR #822', done: false },
  ];
  weeklyProgress = 74;

  monthNames = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
  dayNames = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

  constructor(
    private api: ApiService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    this.generateCalendar();
    this.loadData();
  }

  /* ---- Calendar Generation ---- */
  generateCalendar() {
    this.weeks = [];
    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const lastDay  = new Date(this.currentYear, this.currentMonth + 1, 0);
    const startDay = firstDay.getDay();
    const totalDays = lastDay.getDate();

    let week: (Date | null)[] = [];
    for (let i = 0; i < startDay; i++) week.push(null);
    for (let day = 1; day <= totalDays; day++) {
      week.push(new Date(this.currentYear, this.currentMonth, day));
      if (week.length === 7) { this.weeks.push(week); week = []; }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      this.weeks.push(week);
    }
  }

  prevMonth() {
    this.currentMonth--;
    if (this.currentMonth < 0) { this.currentMonth = 11; this.currentYear--; }
    this.generateCalendar();
  }

  nextMonth() {
    this.currentMonth++;
    if (this.currentMonth > 11) { this.currentMonth = 0; this.currentYear++; }
    this.generateCalendar();
  }

  /* ---- Date Helpers ---- */
  isToday(date: Date | null): boolean {
    if (!date) return false;
    const t = new Date();
    return date.getDate() === t.getDate() &&
           date.getMonth() === t.getMonth() &&
           date.getFullYear() === t.getFullYear();
  }

  isSelected(date: Date | null): boolean {
    if (!date || !this.selectedDate) return false;
    return this.isSameDay(date, this.selectedDate);
  }

  selectDate(date: Date | null) {
    if (date) this.selectedDate = date;
  }

  private isSameDay(a: Date, b: Date): boolean {
    return a.getDate() === b.getDate() &&
           a.getMonth() === b.getMonth() &&
           a.getFullYear() === b.getFullYear();
  }

  private toMidnight(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  /* ---- Task helpers ---- */
  getTasksForDate(date: Date | null): any[] {
    if (!date) return [];
    return this.tasks.filter(t => {
      const d = new Date(t.deadline || t.due_date);
      return this.isSameDay(d, date);
    });
  }

  hasDeadlineOnDate(date: Date | null): boolean {
    if (!date) return false;
    return this.tasks.some(t => {
      const d = new Date(t.deadline || t.due_date);
      return this.isSameDay(d, date);
    });
  }

  /* ---- Meeting helpers ---- */
  getMeetingsForDate(date: Date | null): any[] {
    if (!date) return [];
    return this.meetings.filter(m => {
      const d = new Date(m.date || m.scheduled_at || m.start_time);
      return this.isSameDay(d, date);
    });
  }

  /* ---- Project span helpers ---- */
  /**
   * Returns projects whose span (start_date … end_date/deadline) covers `date`.
   * A project task shows up on every day in its range.
   */
  getProjectsForDate(date: Date | null): any[] {
    if (!date) return [];
    const d = this.toMidnight(date);
    return this.projects.filter(p => {
      const start = this.toMidnight(new Date(p.start_date));
      const end   = this.toMidnight(new Date(p.end_date || p.deadline));
      return d >= start && d <= end;
    });
  }

  isProjectStart(proj: any, date: Date | null): boolean {
    if (!date) return false;
    const start = this.toMidnight(new Date(proj.start_date));
    return this.isSameDay(start, date);
  }

  /* ---- Data Loading ---- */
  loadData() {
    if (!isPlatformBrowser(this.platformId)) return;

    // Load tasks
    this.api.getMyTasks().subscribe({
      next: (res: any) => {
        const all: any[] = Array.isArray(res) ? res : (res.results || []);

        // Separate: items with BOTH start_date AND end_date go to "projects"
        // items with only a deadline go to "tasks"
        this.tasks    = all.filter(t => !(t.start_date && (t.end_date || (t.deadline && t.start_date !== t.deadline))));
        this.projects = all.filter(t => t.start_date && (t.end_date || t.deadline) && t.start_date !== (t.end_date || t.deadline));

        this.buildUpcomingDeadlines();
        this.computeWeeklyProgress();
      },
      error: () => {}
    });

    // Load meetings if API has them
    if ((this.api as any).getMeetings) {
      (this.api as any).getMeetings().subscribe({
        next: (res: any) => {
          this.meetings = Array.isArray(res) ? res : (res.results || []);
          this.buildUpcomingDeadlines();
        },
        error: () => {}
      });
    }
  }

  buildUpcomingDeadlines() {
    const today = this.toMidnight(new Date());
    const inTwoWeeks = new Date(today);
    inTwoWeeks.setDate(today.getDate() + 14);

    const items: any[] = [];

    // Tasks with upcoming deadlines
    this.tasks.forEach(t => {
      const d = new Date(t.deadline || t.due_date);
      if (d >= today && d <= inTwoWeeks) {
        items.push({
          ...t,
          _date: d,
          _type: 'task',
          _typeLabel: t.priority === 'high' ? 'URGENT' : 'TASK',
          _dateLabel: this.formatDateShort(d),
          _timeStr: t.time || ''
        });
      }
    });

    // Projects ending soon
    this.projects.forEach(p => {
      const d = new Date(p.end_date || p.deadline);
      if (d >= today && d <= inTwoWeeks) {
        items.push({
          ...p,
          _date: d,
          _type: 'project',
          _typeLabel: 'PROJECT',
          _dateLabel: this.formatDateShort(d),
          _timeStr: ''
        });
      }
    });

    // Meetings
    this.meetings.forEach(m => {
      const d = new Date(m.date || m.scheduled_at || m.start_time);
      if (d >= today && d <= inTwoWeeks) {
        items.push({
          ...m,
          _date: d,
          _type: 'meeting',
          _typeLabel: 'MEETING',
          _dateLabel: this.formatDateShort(d),
          _timeStr: m.time || (d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
        });
      }
    });

    // Sort ascending by date
    items.sort((a, b) => a._date.getTime() - b._date.getTime());
    this.upcomingDeadlines = items.slice(0, 5);
  }

  computeWeeklyProgress() {
    const total = this.tasks.length;
    if (!total) return;
    const done = this.tasks.filter(t => t.status === 'completed' || t.status === 'done').length;
    this.weeklyProgress = Math.round((done / total) * 100);
  }

  toggleReminder(r: any) {
    r.done = !r.done;
  }

  private formatDateShort(d: Date): string {
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  }
}