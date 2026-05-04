import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { UiService } from '../../core/ui.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  user: any = null;
  firstName = '';
  lastName = '';
  email = '';
  password = '';
  currentPassword = '';
  profilePhoto = '';
  bio = '';
  isVerificationModalOpen = false;
  isPasswordModalOpen = false;

  newPassword = '';
  confirmNewPassword = '';

  isSubmitting = false;
  errorMsg = '';
  successMsg = '';
  activeTab = 'profile';

  // Results Modal State
  isResultsModalOpen = false;
  modalTitle = '';

  isAdmin(): boolean {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('role') === 'ADMIN';
    }
    return false;
  }

  scrollToSection(sectionId: string) {
    this.activeTab = sectionId;
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // Settings Toggles
  atmosphericMode = true;
  performanceRender = false;
  projectMilestones = true;
  mentionAlerts = true;
  dailyVelocityReport = false;

  activeNotifications: any[] = [];
  activeSessions: any[] = [];
  showSessionsList = false;

  constructor(
    private api: ApiService, 
    private ui: UiService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }

  ngOnInit() {
    this.loadProfile();
    this.loadSessions();
    this.ui.notifications$.subscribe(n => {
      this.activeNotifications.push(n);
      setTimeout(() => this.activeNotifications.shift(), 5000);
    });
  }

  loadProfile() {
    this.api.getMe().subscribe({
      next: (u) => {
        this.user = u;
        this.firstName = u.first_name || '';
        this.lastName = u.last_name || '';
        this.email = u.email;
        this.profilePhoto = u.profile_photo || '';
        this.bio = u.bio || '';

        // Preferences Persistence Logic
        if (u.preferences) {
          this.atmosphericMode = u.preferences.atmospheric_mode ?? true;
          this.performanceRender = u.preferences.performance_render ?? false;
          this.projectMilestones = u.preferences.project_milestones ?? true;
          this.mentionAlerts = u.preferences.mention_alerts ?? true;
          this.dailyVelocityReport = u.preferences.daily_velocity_report ?? false;
          this.applySettings();
        }
      },
      error: () => {
        this.errorMsg = 'Failed to load profile data.';
      }
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        this.errorMsg = 'File size must be less than 1MB.';
        return;
      }
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.profilePhoto = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  // --- Real Logic & Simulation Engines ---

  /**
   * Algorithm for Project Milestones:
   * Scans all active projects. If any project progress is >= 80%,
   * and the user has enabled Milestones, trigger a critical alert.
   */
  testMilestoneLogic() {
    this.activeNotifications = [];
    if (!this.projectMilestones) {
      this.ui.notify('Project Milestones are DISABLED.', 'warn');
      return;
    }

    this.modalTitle = 'Project Milestone Analysis';
    this.isResultsModalOpen = true;

    this.api.getProjects().subscribe(projects => {
      this.activeNotifications = [];
      const criticalProjects = projects.filter((p: any) => {
        const total = p.tasks?.length || 0;
        const done = p.tasks?.filter((t: any) => t.status === 'DONE').length || 0;
        const progress = total > 0 ? (done / total) * 100 : 0;
        return progress >= 80 && progress < 100;
      });

      if (criticalProjects.length > 0) {
        criticalProjects.forEach((p: any) => {
          this.ui.notify(`CRITICAL PATH: "${p.name}" has reached 80% completion!`, 'success');
        });
      } else {
        this.ui.notify('No projects currently at the 80% milestone.', 'info');
      }
    });
  }

  /**
   * Algorithm for Mention Alerts:
   * Simulates an incoming tag from a colleague. Checks user preference before displaying.
   */
  simulateMention() {
    this.activeNotifications = [];
    if (!this.mentionAlerts) {
      this.ui.notify('Mention Alerts are DISABLED.', 'warn');
      return;
    }

    this.modalTitle = 'Incoming Mention Simulation';
    this.isResultsModalOpen = true;

    this.api.getEmployees().subscribe(users => {
      if (users && users.length > 0) {
        const randomUser = users[Math.floor(Math.random() * users.length)];
        const name = `${randomUser.first_name} ${randomUser.last_name}`;
        this.ui.notify(`${name} mentioned you in "Database Migration" task.`, 'info');
      } else {
        this.ui.notify(`Someone mentioned you in a task.`, 'info');
      }
    });
  }

  /**
   * Algorithm for Daily Velocity Report:
   * Aggregates team performance data for the day. Checks user preference before generating digest.
   */
  generateVelocityReport() {
    this.activeNotifications = [];
    if (!this.dailyVelocityReport) {
      this.ui.notify('Daily Velocity Report is DISABLED.', 'warn');
      return;
    }

    this.modalTitle = 'Daily Velocity Performance';
    this.isResultsModalOpen = true;

    this.api.getTasks().subscribe(tasks => {
      this.activeNotifications = [];
      const overdue = tasks.filter((t: any) => t.status !== 'DONE' && new Date(t.deadline) < new Date()).length;
      const completedToday = Math.floor(Math.random() * 15) + 5; // Mock data for demo
      this.ui.notify(`MORNING DIGEST: ${completedToday} tasks completed today. ${overdue} tasks are currently overdue.`, 'success');
    });
  }

  updateProfile() {
    this.isVerificationModalOpen = true;
    this.currentPassword = '';
    this.errorMsg = '';
  }

  confirmProfileUpdate() {
    if (!this.currentPassword) {
      this.errorMsg = 'Current password is required.';
      return;
    }

    this.isSubmitting = true;
    this.errorMsg = '';
    this.successMsg = '';

    const payload: any = {
      current_password: this.currentPassword,
      first_name: this.firstName,
      last_name: this.lastName,
      email: this.email,
      profile_photo: this.profilePhoto,
      bio: this.bio,
      preferences: {
        atmospheric_mode: this.atmosphericMode,
        performance_render: this.performanceRender,
        project_milestones: this.projectMilestones,
        mention_alerts: this.mentionAlerts,
        daily_velocity_report: this.dailyVelocityReport
      }
    };

    if (this.password) {
      payload.password = this.password;
    }

    this.api.updateMe(payload).subscribe({
      next: (res) => {
        this.user = res.user;
        this.successMsg = 'Profile updated successfully!';
        this.password = '';
        this.currentPassword = '';
        this.isSubmitting = false;
        this.isVerificationModalOpen = false;
        this.applySettings();
        setTimeout(() => window.location.reload(), 1500);
      },
      error: (err) => {
        this.errorMsg = err.error?.error || 'Failed to update profile.';
        this.isSubmitting = false;
      }
    });
  }

  /**
   * System Algorithm: Applies the physical UI effects based on toggle states.
   */
  applySettings() {
    // Atmospheric Mode Logic: Adds high-contrast obsidian classes to body
    if (this.atmosphericMode) {
      document.body.classList.add('atmospheric-theme');
    } else {
      document.body.classList.remove('atmospheric-theme');
    }

    // Performance Render Logic: Disables backdrop filters and transitions globally
    if (this.performanceRender) {
      document.body.classList.add('low-perf-mode');
    } else {
      document.body.classList.remove('low-perf-mode');
    }
  }

  /**
   * Real-time Sync: Saves preferences to the database instantly when toggled.
   */
  savePreferences() {
    this.applySettings();
    const payload = {
      preferences: {
        atmospheric_mode: this.atmosphericMode,
        performance_render: this.performanceRender,
        project_milestones: this.projectMilestones,
        mention_alerts: this.mentionAlerts,
        daily_velocity_report: this.dailyVelocityReport
      }
    };
    this.api.updatePreferences(payload).subscribe({
      next: () => console.log('Preferences synced successfully.'),
      error: () => this.ui.notify('Failed to sync preferences to database.', 'warn')
    });
  }

  openPasswordModal() {
    this.isPasswordModalOpen = true;
    this.currentPassword = '';
    this.newPassword = '';
    this.confirmNewPassword = '';
    this.errorMsg = '';
  }

  confirmPasswordUpdate() {
    if (!this.currentPassword || !this.newPassword || !this.confirmNewPassword) {
      this.errorMsg = 'All fields are required.';
      return;
    }
    if (this.newPassword !== this.confirmNewPassword) {
      this.errorMsg = 'New passwords do not match.';
      return;
    }
    if (this.newPassword.length < 6) {
      this.errorMsg = 'Password must be at least 6 characters.';
      return;
    }

    this.isSubmitting = true;
    this.errorMsg = '';

    const payload = {
      current_password: this.currentPassword,
      password: this.newPassword
    };

    this.api.updateMe(payload).subscribe({
      next: () => {
        this.ui.notify('Password updated successfully.', 'success');
        this.isPasswordModalOpen = false;
        this.isSubmitting = false;
      },
      error: (err) => {
        this.errorMsg = err.error?.error || 'Failed to update password.';
        this.isSubmitting = false;
      }
    });
  }

  loadSessions() {
    this.api.getSessions().subscribe({
      next: (sessions) => {
        this.activeSessions = sessions;
      },
      error: () => {
        this.ui.notify('Failed to load active sessions.', 'warn');
      }
    });
  }

  disconnectSession(sessionId: string) {
    if (!confirm('Are you sure you want to disconnect this device?')) return;
    
    this.api.revokeSession(sessionId).subscribe({
      next: () => {
        this.ui.notify('Device disconnected.', 'success');
        this.loadSessions();
      },
      error: (err) => {
        this.ui.notify(err.error?.error || 'Failed to disconnect device.', 'warn');
      }
    });
  }
}
