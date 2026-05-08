import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ApiService } from '../../../core/api.service';

@Component({
  selector: 'app-employee-projects',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './projects.component.html',
  styleUrls: ['./projects.component.css']
})
export class ProjectsComponent implements OnInit {
  projects: any[] = [];
  topProjects: any[] = [];
  remainingProjects: any[] = [];
  featuredProject: any = null;
  sideProject: any = null;
  streamActivity: any[] = [];
  loading = false;

  selectedProject: any = null;
  showDetailsModal: boolean = false;
  showUpdateModal: boolean = false;

  constructor(
    private api: ApiService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadProjects();
      this.loadActivityStream();
    }
  }

  loadProjects() {
    this.api.getMyProjects().subscribe({
      next: (res: any) => {
        if (res && res.length > 0) {
          const mapped = res.map((p: any, index: number) => ({
            ...p,
            projectCategory: p.is_high_priority ? 'PRIORITY ONE' : `${p.department_name || 'GENERAL'} • ${p.start_date ? new Date(p.start_date).toLocaleDateString('en-US', {month: 'short', year: 'numeric'}) : ''}`,
            displayStatus: p.status || 'Pending',
            displayPriority: p.priority || 'MEDIUM',
            progress: p.progress || this.calculateProgress(p),
            deadline: p.deadline ? new Date(p.deadline).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'No Deadline',
            team: p.employees?.map((e: any) => `https://i.pravatar.cc/150?u=${e.id}`) || [
              `https://i.pravatar.cc/150?u=${index + 10}`,
              `https://i.pravatar.cc/150?u=${index + 11}`
            ],
            moreTeam: p.employees?.length > 2 ? p.employees.length - 2 : 0
          }));

          this.projects = mapped;
          
          // Layout distribution
          this.topProjects = mapped.slice(0, 3);
          this.sideProject = mapped.length > 3 ? mapped[3] : null;
          this.featuredProject = mapped.length > 4 ? mapped[4] : (mapped.length > 3 ? null : mapped[0]); // Fallback
          if (this.featuredProject) this.featuredProject.efficiency = '98.5%';
          
          this.remainingProjects = mapped.length > 5 ? mapped.slice(5) : [];
        } else {
          this.setMockProjects();
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load projects', err);
        this.setMockProjects();
        this.loading = false;
      }
    });
  }

  private setMockProjects() {
    const mock = [
      {
        id: 1,
        name: 'Expansion Project 33',
        client: 'Global Solutions',
        progress: 67,
        is_high_priority: true,
        status: 'In Progress',
        deadline: '2027-02-26',
        projectCategory: 'PRIORITY ONE',
        displayStatus: 'In Progress',
        team: ['https://i.pravatar.cc/150?u=1', 'https://i.pravatar.cc/150?u=2', 'https://i.pravatar.cc/150?u=3'],
        moreTeam: 2,
        efficiency: '99.8%'
      },
      {
        id: 2,
        name: 'Bio-Metric Auth',
        client: 'FinTech Corp',
        progress: 82,
        is_high_priority: false,
        status: 'Active',
        deadline: '2027-01-15',
        projectCategory: 'FINANCE • Jan 2027',
        displayStatus: 'Active',
        team: ['https://i.pravatar.cc/150?u=4', 'https://i.pravatar.cc/150?u=5'],
        moreTeam: 0
      },
      {
        id: 3,
        name: 'Cloud Migration',
        client: 'DataStream',
        progress: 45,
        is_high_priority: false,
        status: 'In Progress',
        deadline: '2027-03-10',
        projectCategory: 'INFRA • Mar 2027',
        displayStatus: 'In Progress',
        team: ['https://i.pravatar.cc/150?u=6', 'https://i.pravatar.cc/150?u=7', 'https://i.pravatar.cc/150?u=8'],
        moreTeam: 1
      },
      {
        id: 4,
        name: 'AI Analytics',
        client: 'MarketSense',
        progress: 30,
        is_high_priority: true,
        status: 'On Hold',
        deadline: '2027-04-01',
        projectCategory: 'PRIORITY ONE',
        displayStatus: 'On Hold',
        team: ['https://i.pravatar.cc/150?u=9'],
        moreTeam: 0
      },
      {
        id: 5,
        name: 'Mobile Core 2.0',
        client: 'AppLeap',
        progress: 90,
        is_high_priority: false,
        status: 'Review',
        deadline: '2026-12-20',
        projectCategory: 'MOBILE • Dec 2026',
        displayStatus: 'Completed',
        team: ['https://i.pravatar.cc/150?u=10', 'https://i.pravatar.cc/150?u=11'],
        moreTeam: 3
      }
    ];

    this.projects = mock;
    this.topProjects = mock.slice(0, 3);
    this.sideProject = mock[3];
    this.featuredProject = mock[4] || mock[0];
    this.remainingProjects = mock.slice(5);
  }

  loadActivityStream() {
    this.api.getMe().subscribe({
      next: (user: any) => {
        if (user && user.id) {
          this.api.getEmployeeHistory(user.id).subscribe({
            next: (res: any) => {
              if (res && res.projects) {
                const activities: any[] = [];
                
                res.projects.forEach((p: any) => {
                  if (p.tasks) {
                    p.tasks.forEach((t: any) => {
                      // Use non-strict equality and check multiple possible ID/name fields
                      const userId = user.id || user._id;
                      const userName = `${user.first_name} ${user.last_name}`.toLowerCase();
                      
                      const taskActorId = t.completed_by?.id || t.completed_by?._id || t.completed_by || t.user_id || t.assigned_to?.id || t.assigned_to;
                      const taskActorName = (t.completed_by_name || t.completed_by?.name || '').toLowerCase();
                      
                      const isActor = (taskActorId == userId) || (taskActorName === userName && userName.length > 5);
                      
                      if (isActor && (t.status === 'DONE' || t.status === 'IN_PROGRESS')) {
                        const timestamp = t.completed_at || p.start_date;
                        activities.push({
                          time: this.formatActivityTime(timestamp),
                          timestamp: timestamp,
                          title: t.status === 'DONE' ? `Task Completed: ${t.title}` : `Task Started: ${t.title}`,
                          subtitle: `${p.name} • ${t.title}`,
                          icon: t.status === 'DONE' ? 'check' : 'link'
                        });
                      }
                    });
                  }
                });

                this.streamActivity = activities
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .slice(0, 5);
                
                // Final fallback if no personal activity found
                if (this.streamActivity.length === 0) this.setMockActivity();
              } else {
                this.setMockActivity();
              }
            },
            error: () => this.setMockActivity()
          });
        } else {
          this.setMockActivity();
        }
      },
      error: () => this.setMockActivity()
    });
  }

  private setMockActivity() {
    this.streamActivity = [
      {
        time: 'Just now',
        title: 'Project Milestone Reached',
        subtitle: 'Expansion Project 33 • Core System Integration',
        icon: 'rocket'
      },
      {
        time: '12 min ago',
        title: 'Task Completed',
        subtitle: 'Global Solutions • API Authentication Module',
        icon: 'check'
      },
      {
        time: '09:14 AM',
        title: 'New Documentation Linked',
        subtitle: 'Security Audit • Cloud Infrastructure',
        icon: 'link'
      },
      {
        time: 'Yesterday',
        title: 'Task Started',
        subtitle: 'Bio-Metric Auth • Database Schema Design',
        icon: 'link'
      }
    ];
  }

  private mapStatus(status: string): string {
    const s = status?.toUpperCase();
    if (s === 'ACTIVE' || s === 'IN_PROGRESS') return 'ACTIVE';
    if (s === 'ON_HOLD' || s === 'PENDING') return 'ON HOLD';
    if (s === 'COMPLETED' || s === 'DONE' || s === 'REVIEW') return 'IN REVIEW';
    return 'ACTIVE';
  }

  private calculateProgress(p: any): number {
    if (!p.tasks || p.tasks.length === 0) return 0;
    const done = p.tasks.filter((t: any) => t.status === 'DONE').length;
    return Math.round((done / p.tasks.length) * 100);
  }

  private formatActivityTime(timestamp: string): string {
    if (!timestamp) return 'Just now';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 3600000) return Math.round(diff / 60000) + ' min ago';
    if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diff < 172800000) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  private mapActivityIcon(action: string): string {
    const a = action?.toLowerCase();
    if (a.includes('update') || a.includes('edit')) return 'link';
    if (a.includes('complete') || a.includes('approve') || a.includes('done')) return 'check';
    if (a.includes('start') || a.includes('create') || a.includes('init')) return 'rocket';
    return 'link';
  }

  openDetails(project: any): void {
    this.selectedProject = project;
    this.showDetailsModal = true;
  }

  closeDetails(): void {
    this.showDetailsModal = false;
    this.selectedProject = null;
  }

  openUpdate(project: any): void {
    this.selectedProject = project;
    this.showUpdateModal = true;
  }

  closeUpdate(): void {
    this.showUpdateModal = false;
    this.selectedProject = null;
  }
}
