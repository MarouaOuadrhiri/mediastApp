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
  viewMode: 'month' | 'week' | 'day' = 'month';

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
  
  /** Project lanes for consistent vertical positioning */
  projectLanes: { [key: string]: number } = {};
  colorPalette = [
    '#6366F1', '#8B5CF6', '#EC4899', '#10B981', '#3B82F6', 
    '#F59E0B', '#06B6D4', '#84CC16', '#A855F7', '#F43F5E'
  ];

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
    if (this.viewMode === 'month') {
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
    } else if (this.viewMode === 'week') {
      const startOfWeek = new Date(this.currentDate);
      startOfWeek.setDate(this.currentDate.getDate() - this.currentDate.getDay());
      const week: (Date | null)[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        week.push(d);
      }
      this.weeks = [week];
    } else {
      this.weeks = [[new Date(this.currentDate)]];
    }
  }

  setViewMode(mode: 'month' | 'week' | 'day') {
    this.viewMode = mode;
    this.generateCalendar();
  }

  prev() {
    if (this.viewMode === 'month') this.prevMonth();
    else if (this.viewMode === 'week') {
      this.currentDate.setDate(this.currentDate.getDate() - 7);
      this.syncMonthYear();
      this.generateCalendar();
    } else {
      this.currentDate.setDate(this.currentDate.getDate() - 1);
      this.syncMonthYear();
      this.generateCalendar();
    }
  }

  next() {
    if (this.viewMode === 'month') this.nextMonth();
    else if (this.viewMode === 'week') {
      this.currentDate.setDate(this.currentDate.getDate() + 7);
      this.syncMonthYear();
      this.generateCalendar();
    } else {
      this.currentDate.setDate(this.currentDate.getDate() + 1);
      this.syncMonthYear();
      this.generateCalendar();
    }
  }

  private syncMonthYear() {
    this.currentMonth = this.currentDate.getMonth();
    this.currentYear = this.currentDate.getFullYear();
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
   * Returns an array where the index corresponds to the assigned lane.
   */
  getProjectsForDate(date: Date | null): (any | null)[] {
    if (!date) return [];
    const d = this.toMidnight(date);
    
    if (Object.keys(this.projectLanes).length === 0 && this.projects.length > 0) {
      this.calculateProjectLanes();
    }

    const projectsOnDate = this.projects.filter(p => {
      const start = this.toMidnight(new Date(p.start_date || p.created_at));
      const end   = this.toMidnight(new Date(p.deadline || p.end_date));
      return d >= start && d <= end;
    });

    if (projectsOnDate.length === 0) return [];

    const maxLane = Math.max(...projectsOnDate.map(p => this.projectLanes[p.id || p.name] || 0));
    const slots = new Array(maxLane + 1).fill(null);

    projectsOnDate.forEach(p => {
      const lane = this.projectLanes[p.id || p.name] || 0;
      slots[lane] = p;
    });

    return slots;
  }

  /**
   * Simple lane assignment to prevent overlaps and jumping
   */
  private calculateProjectLanes() {
    const sortedProjects = [...this.projects].sort((a, b) => 
      new Date(a.start_date || a.created_at).getTime() - new Date(b.start_date || b.created_at).getTime()
    );

    const lanes: any[][] = []; // Array of projects per lane

    sortedProjects.forEach(proj => {
      const start = new Date(proj.start_date || proj.created_at).getTime();
      let assignedLane = -1;

      for (let i = 0; i < lanes.length; i++) {
        // Check if project overlaps with any project in this lane
        const overlaps = lanes[i].some(p => {
          const pStart = new Date(p.start_date || p.created_at).getTime();
          const pEnd = new Date(p.deadline || p.end_date).getTime();
          const projEnd = new Date(proj.deadline || proj.end_date).getTime();
          return (start <= pEnd && projEnd >= pStart);
        });

        if (!overlaps) {
          assignedLane = i;
          lanes[i].push(proj);
          break;
        }
      }

      if (assignedLane === -1) {
        assignedLane = lanes.length;
        lanes.push([proj]);
      }

      this.projectLanes[proj.id || proj.name] = assignedLane;
    });
  }

  getProjectColor(proj: any): string {
    const id = proj.id || proj.name;
    const lane = this.projectLanes[id] || 0;
    return this.colorPalette[lane % this.colorPalette.length];
  }

  isProjectEnd(proj: any, date: Date | null): boolean {
    if (!date) return false;
    const end = this.toMidnight(new Date(proj.deadline || proj.end_date));
    return this.isSameDay(end, date);
  }

  isNearDeadline(proj: any): boolean {
    if (!proj.deadline) return false;
    const deadline = new Date(proj.deadline).getTime();
    const now = new Date().getTime();
    const diffDays = (deadline - now) / (1000 * 86400);
    return diffDays >= 0 && diffDays <= 7;
  }

  isProjectStart(proj: any, date: Date | null): boolean {
    if (!date) return false;
    const start = this.toMidnight(new Date(proj.start_date));
    return this.isSameDay(start, date);
  }

  /* ---- Data Loading ---- */
  loadData() {
    if (!isPlatformBrowser(this.platformId)) return;

    // Load Projects first for the timeline view
    this.api.getMyProjects().subscribe({
      next: (res: any) => {
        this.projects = res || [];
        this.projectLanes = {}; // Reset lanes for new data
        this.calculateProjectLanes();
        this.buildUpcomingDeadlines();
      },
      error: () => {}
    });

    // Load tasks
    this.api.getMyTasks().subscribe({
      next: (res: any) => {
        const all: any[] = Array.isArray(res) ? res : (res.results || []);
        this.tasks = all;
        this.buildUpcomingDeadlines();
        this.computeWeeklyProgress();
      },
      error: () => {}
    });

    // Load meetings
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
    inTwoWeeks.setDate(today.getDate() + 30); // Look further for projects

    const items: any[] = [];

    // Projects (Primary focus for sidebar as requested)
    this.projects.forEach(p => {
      const d = new Date(p.deadline || p.end_date);
      if (d >= today) {
        const diffDays = Math.ceil((d.getTime() - today.getTime()) / 86400000);
        items.push({
          ...p,
          _date: d,
          _type: 'project',
          _typeLabel: 'PROJECT',
          _dateLabel: this.formatDateShort(d),
          _timeStr: `${diffDays} days left`,
          _diff: diffDays
        });
      }
    });

    // Sort ascending by deadline urgency
    items.sort((a, b) => a._diff - b._diff);
    this.upcomingDeadlines = items.slice(0, 3); // Top 3 projects

    // If we have less than 3 projects, add tasks/meetings
    if (this.upcomingDeadlines.length < 3) {
      const extras: any[] = [];
      this.tasks.forEach(t => {
        const d = new Date(t.deadline || t.due_date);
        if (d >= today && d <= inTwoWeeks) {
          extras.push({
            ...t,
            _date: d,
            _type: 'task',
            _typeLabel: 'TASK',
            _dateLabel: this.formatDateShort(d),
            _timeStr: ''
          });
        }
      });
      extras.sort((a, b) => a._date.getTime() - b._date.getTime());
      this.upcomingDeadlines = [...this.upcomingDeadlines, ...extras].slice(0, 3);
    }
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