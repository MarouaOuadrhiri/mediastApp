import { Component, OnInit, Inject, PLATFORM_ID, ChangeDetectorRef, ViewEncapsulation, ViewChild } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { 
  ScheduleModule, 
  EventSettingsModel, 
  DayService, 
  WeekService, 
  WorkWeekService, 
  MonthService, 
  AgendaService, 
  ResizeService, 
  DragAndDropService,
  EventRenderedArgs,
  ScheduleComponent,
  View
} from '@syncfusion/ej2-angular-schedule';
import { ApiService } from '../../../core/api.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-employee-calendar',
  standalone: true,
  imports: [CommonModule, ScheduleModule],
  providers: [DayService, WeekService, WorkWeekService, MonthService, AgendaService, ResizeService, DragAndDropService],
  templateUrl: './calendar.component.html',
  styleUrls: ['./calendar.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class CalendarComponent implements OnInit {
  @ViewChild('scheduleObj') public scheduleObj?: ScheduleComponent;

  public selectedDate: Date = new Date();
  public currentView: View = 'Month';
  public eventSettings: EventSettingsModel = {
    dataSource: [],
    fields: {
      id: 'Id',
      subject: { name: 'Subject' },
      startTime: { name: 'StartTime' },
      endTime: { name: 'EndTime' },
      description: { name: 'Description' }
    }
  };

  /** Statistics and Side Panel Data */
  upcomingDeadlines: any[] = [];
  weeklyProgress = 0;
  reminders = [
    { text: 'Mise à jour des feuilles de temps Q4', done: false },
    { text: 'Email client pour révisions', done: false },
    { text: 'Révision PR #822', done: false },
  ];

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadData();
    }
  }

  loadData() {
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
              Id: `project-${p.id}`,
              Subject: p.name,
              StartTime: new Date(p.start_date || p.created_at),
              EndTime: new Date(p.deadline || p.end_date || new Date(p.start_date || p.created_at).getTime() + 3600000),
              Description: p.description || '',
              Category: 'project',
              RawData: p
            });
          });
        }

        // 2. Tasks (Emerald/Green)
        const tasksList = Array.isArray(data.tasks) ? data.tasks : (data.tasks.results || []);
        tasksList.forEach((t: any) => {
          const taskDate = new Date(t.deadline || t.due_date || t.created_at);
          events.push({
            Id: `task-${t.id}`,
            Subject: t.title,
            StartTime: taskDate,
            EndTime: new Date(taskDate.getTime() + 3600000),
            IsAllDay: true,
            Description: t.description || '',
            Category: 'task',
            RawData: t
          });
        });

        // 3. Meetings (Rose/Red)
        const meetingsList = Array.isArray(data.meetings) ? data.meetings : (data.meetings.results || []);
        meetingsList.forEach((m: any) => {
          events.push({
            Id: `meeting-${m.id}`,
            Subject: m.title,
            StartTime: new Date(m.date_time || m.start_time),
            EndTime: m.end_time ? new Date(m.end_time) : new Date(new Date(m.date_time || m.start_time).getTime() + 3600000),
            Description: m.description || '',
            Category: 'meeting',
            RawData: m
          });
        });

        this.eventSettings = { ...this.eventSettings, dataSource: events };
        
        // Update Sidebar/Stats
        this.computeStats(data.projects, tasksList);
        this.cdr.markForCheck();
      },
      error: (err) => console.error('Error loading scheduler data:', err)
    });
  }

  computeStats(projects: any[], tasks: any[]) {
    if (tasks.length > 0) {
      const done = tasks.filter(t => t.status === 'completed' || t.status === 'done').length;
      this.weeklyProgress = Math.round((done / tasks.length) * 100);
    }

    const today = new Date();
    today.setHours(0,0,0,0);
    
    this.upcomingDeadlines = projects
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

  onEventRendered(args: EventRenderedArgs): void {
    const category = args.data['Category'];
    let backgroundColor = '#3B82F6'; // Default project blue
    
    if (category === 'task') {
      backgroundColor = '#10B981'; // Emerald
    } else if (category === 'meeting') {
      backgroundColor = '#F43F5E'; // Rose
    }
    
    args.element.style.backgroundColor = backgroundColor;
    args.element.style.borderLeft = `4px solid ${backgroundColor}`;
    args.element.style.borderRadius = '8px';
  }

  onEventClick(args: any): void {
    const event = args.event;
    // Removed alert as requested. 
    // You can implement a custom modal here if needed.
    console.log('Event Clicked:', event.Subject, event.Category);
  }

  toggleReminder(r: any) {
    r.done = !r.done;
  }
}