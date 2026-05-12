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

@Component({
  selector: 'app-employee-calendar',
  standalone: true,
  imports: [
    CommonModule, 
    FullCalendarModule,
    CardModule,
    ButtonModule,
    TooltipModule
  ],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class CalendarComponent implements OnInit, OnDestroy {
  public calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
    },
    themeSystem: 'standard',
    editable: false,
    selectable: true,
    dayMaxEvents: false,
    locale: 'fr',
    events: [],
    eventClick: this.handleEventClick.bind(this),
    eventContent: this.renderEventContent.bind(this),
    height: '650px',
  };

  /** Statistics and Side Panel Data */
  upcomingDeadlines: any[] = [];
  weeklyProgress = 0;
  reminders = [
    { text: 'Mise à jour des feuilles de temps Q4', done: false },
    { text: 'Email client pour révisions', done: false },
    { text: 'Révision PR #822', done: false },
  ];

  private refreshInterval: any;

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadData();
      
      // Dynamic refresh every 30 seconds
      this.refreshInterval = setInterval(() => {
        this.loadData(true);
      }, 30000);
    }
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  loadData(isRefresh = false) {
    forkJoin({
      projects: this.api.getMyProjects(),
      tasks: this.api.getMyTasks(),
      meetings: this.api.getMeetings ? this.api.getMeetings() : forkJoin([])
    }).subscribe({
      next: (data: any) => {
        const events: any[] = [];

        // 1. Projects (Blue/Indigo)
        if (data.projects) {
          data.projects.forEach((p: any) => {
            events.push({
              id: `project-${p.id}`,
              title: p.name,
              start: p.start_date || p.created_at,
              end: p.deadline || p.end_date || new Date(p.start_date || p.created_at).getTime() + 3600000,
              backgroundColor: '#3B82F6',
              borderColor: '#3B82F6',
              extendedProps: {
                category: 'project',
                rawData: p
              }
            });
          });
        }

        // 2. Tasks (Emerald/Green)
        const tasksList = Array.isArray(data.tasks) ? data.tasks : (data.tasks.results || []);
        tasksList.forEach((t: any) => {
          const taskDate = new Date(t.deadline || t.due_date || t.created_at);
          events.push({
            id: `task-${t.id}`,
            title: t.title,
            start: taskDate,
            allDay: true,
            backgroundColor: '#10B981',
            borderColor: '#10B981',
            extendedProps: {
              category: 'task',
              rawData: t
            }
          });
        });

        // 3. Meetings (Rose/Red)
        const meetingsList = Array.isArray(data.meetings) ? data.meetings : (data.meetings.results || []);
        meetingsList.forEach((m: any) => {
          events.push({
            id: `meeting-${m.id}`,
            title: m.title,
            start: m.date_time || m.start_time,
            end: m.end_time || new Date(new Date(m.date_time || m.start_time).getTime() + 3600000),
            backgroundColor: '#F43F5E',
            borderColor: '#F43F5E',
            extendedProps: {
              category: 'meeting',
              rawData: m
            }
          });
        });

        this.calendarOptions.events = events;
        
        // Update Sidebar/Stats
        this.computeStats(data.projects, tasksList);
        this.cdr.markForCheck();
      },
      error: (err) => {
        if (!isRefresh) console.error('Error loading scheduler data:', err);
      }
    });
  }

  computeStats(projects: any[], tasks: any[]) {
    if (tasks.length > 0) {
      const done = tasks.filter(t => t.status === 'completed' || t.status === 'done').length;
      this.weeklyProgress = Math.round((done / tasks.length) * 100);
    }

    const today = new Date();
    today.setHours(0,0,0,0);
    
    this.upcomingDeadlines = (projects || [])
      .filter(p => {
        const d = new Date(p.deadline || p.end_date);
        return d >= today;
      })
      .map(p => {
        const d = new Date(p.deadline || p.end_date);
        const diffDays = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return {
          ...p,
          _diff: diffDays,
          _dateLabel: d.toLocaleDateString('fr-FR', { month: 'short', day: '2-digit' })
        };
      })
      .sort((a, b) => a._diff - b._diff)
      .slice(0, 3);
  }

  renderEventContent(eventInfo: EventContentArg) {
    const category = eventInfo.event.extendedProps['category'];
    const title = eventInfo.event.title;
    
    let iconHtml = '';
    if (category === 'task') {
      iconHtml = `<svg class="fc-event-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="width:14px; height:14px;">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>`;
    } else if (category === 'meeting') {
      iconHtml = `<svg class="fc-event-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px; height:14px;">
                    <path d="M23 7l-7 5 7 5V7z"></path>
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                  </svg>`;
    }

    return {
      html: `
        <div class="event-template-wrap ${category}">
          ${iconHtml}
          <div class="event-subject">${title}</div>
        </div>
      `
    };
  }

  handleEventClick(arg: any): void {
    const event = arg.event;
    console.log('Event Clicked:', event.title, event.extendedProps.category);
  }

  toggleReminder(r: any) {
    r.done = !r.done;
  }
}
