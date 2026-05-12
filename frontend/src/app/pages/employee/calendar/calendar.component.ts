import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, ChangeDetectorRef, ViewEncapsulation } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions, EventContentArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { ApiService } from '../../../core/api.service';
import { forkJoin } from 'rxjs';

// PrimeNG Imports
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-employee-calendar',
  standalone: true,
  imports: [
    CommonModule, 
    FullCalendarModule,
    CardModule,
    ButtonModule,
    TooltipModule,
    FormsModule
  ],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class CalendarComponent implements OnInit, OnDestroy {
  public calendarOptions: CalendarOptions = {
    initialView: 'dayGridMonth',
    locale: 'fr',
  };

  /** Statistics and Side Panel Data */
  currentMonthDeadlines: any[] = [];
  allProjects: any[] = [];
  allTasks: any[] = [];
  allMeetings: any[] = [];
  
  weeklyProgress = 74;
  reminders = [
    { text: 'Update timesheets for Q4', done: false },
    { text: 'Email client regarding revisions', done: false },
    { text: 'Review PR #822', done: false },
  ];

  private refreshInterval: any;
  private currentViewInfo: any;

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.initCalendarOptions();
      this.loadData();
      
      this.refreshInterval = setInterval(() => {
        this.loadData(true);
      }, 30000);
    }
  }

  private initCalendarOptions() {
    this.calendarOptions = {
      plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
      initialView: 'dayGridMonth',
      headerToolbar: {
        left: 'prev title next',
        center: '',
        right: ''
      },
      themeSystem: 'standard',
      editable: false,
      selectable: true,
      dayMaxEvents: false,
      locale: 'fr',
      events: [],
      eventClick: this.handleEventClick.bind(this),
      eventContent: this.renderEventContent.bind(this),
      datesSet: this.handleDatesSet.bind(this),
      height: 'auto',
      aspectRatio: 2.2,
      dayHeaderFormat: { weekday: 'short' },
      dayCellContent: (arg) => {
        return { html: `<div class="day-cell-inner">${arg.dayNumberText}</div>` };
      }
    };
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  handleDatesSet(arg: any) {
    this.currentViewInfo = arg;
    this.filterSideBarData();
  }

  loadData(isRefresh = false) {
    forkJoin({
      projects: this.api.getMyProjects(),
      tasks: this.api.getMyTasks(),
      meetings: this.api.getMeetings ? this.api.getMeetings() : forkJoin([])
    }).subscribe({
      next: (data: any) => {
        this.allProjects = data.projects || [];
        this.allTasks = Array.isArray(data.tasks) ? data.tasks : (data.tasks.results || []);
        this.allMeetings = Array.isArray(data.meetings) ? data.meetings : (data.meetings.results || []);

        const events: any[] = [];

        // 1. Projects
        this.allProjects.forEach((p: any) => {
          events.push({
            id: `project-${p.id}`,
            title: p.name,
            start: p.start_date || p.created_at,
            end: p.deadline || p.end_date,
            backgroundColor: 'transparent',
            extendedProps: {
              category: 'project',
              rawData: p
            }
          });
        });

        // 2. Tasks
        this.allTasks.forEach((t: any) => {
          events.push({
            id: `task-${t.id}`,
            title: t.title,
            start: t.deadline || t.due_date,
            allDay: true,
            extendedProps: {
              category: 'task',
              rawData: t
            }
          });
        });

        // 3. Meetings
        this.allMeetings.forEach((m: any) => {
          events.push({
            id: `meeting-${m.id}`,
            title: m.title,
            start: m.date_time || m.start_time,
            extendedProps: {
              category: 'meeting',
              rawData: m
            }
          });
        });

        this.calendarOptions.events = events;
        this.filterSideBarData();
        this.cdr.markForCheck();
      },
      error: (err) => {
        if (!isRefresh) console.error('Error loading scheduler data:', err);
      }
    });
  }

  filterSideBarData() {
    if (!this.currentViewInfo) return;

    const start = this.currentViewInfo.view.activeStart;
    const end = this.currentViewInfo.view.activeEnd;

    // Filter projects/tasks/meetings for the sidebar within the current month
    const list: any[] = [];

    // Combine all to show in "Upcoming Deadlines"
    this.allProjects.forEach(p => {
      const d = new Date(p.deadline || p.end_date);
      if (d >= start && d <= end) {
        list.push({
          title: p.name,
          date: d,
          type: 'PROJECT',
          time: '11:00 AM' // Mock time if not in API
        });
      }
    });

    this.allTasks.forEach(t => {
      const d = new Date(t.deadline || t.due_date);
      if (d >= start && d <= end) {
        list.push({
          title: t.title,
          date: d,
          type: 'CRITICAL',
          time: '04:00 PM'
        });
      }
    });

    this.allMeetings.forEach(m => {
      const d = new Date(m.date_time || m.start_time);
      if (d >= start && d <= end) {
        list.push({
          title: m.title,
          date: d,
          type: 'MEETING',
          time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        });
      }
    });

    this.currentMonthDeadlines = list.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 3);
  }

  renderEventContent(eventInfo: EventContentArg) {
    const category = eventInfo.event.extendedProps['category'];
    const title = eventInfo.event.title;
    
    if (category === 'project') {
      return {
        html: `<div class="event-project-row">
                 <div class="project-name">${title}</div>
                 <div class="project-line"></div>
               </div>`
      };
    }

    // Pill for Tasks/Meetings with Title
    const pillClass = category === 'task' ? 'pill-task' : 'pill-meeting';
    const tag = category === 'task' ? 'TASK' : 'MEETING';

    return {
      html: `<div class="event-pill ${pillClass}">
               <span class="pill-tag">${tag}</span>
               <span class="pill-title">${title}</span>
             </div>`
    };
  }

  handleEventClick(arg: any): void {
    console.log('Event Clicked:', arg.event.title);
  }

  toggleReminder(r: any) {
    r.done = !r.done;
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  }
}


