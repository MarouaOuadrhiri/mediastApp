import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';
import { UiService } from '../../../core/ui.service';

@Component({
  selector: 'app-employee-profile',
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
  profilePhoto = '';
  bio = '';
  isSubmitting = false;
  isPasswordModalOpen = false;
  isVerificationModalOpen = false;
  currentPassword = '';
  newPassword = '';

  // Data that will be populated from stats
  skills: string[] = [];
  milestones: any[] = [];
  portfolioItems: any[] = [];
  
  stats = {
    tenure: '0 Months',
    ongoing_projects_count: 0,
    global_points: 0,
    efficiency: 0,
    feedback: 0,
    sprint_load: 0,
    weekly_hours: 0,
    lead_time: 0
  };

  constructor(
    private api: ApiService,
    private ui: UiService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    this.loadProfile();
  }

  loadProfile() {
    this.api.getMe().subscribe({
      next: (u: any) => {
        this.user = u;
        this.firstName = u.first_name || '';
        this.lastName = u.last_name || '';
        this.email = u.email;
        this.profilePhoto = u.profile_photo || '';
        this.bio = u.bio || '';
        this.skills = u.skills && u.skills.length > 0 ? u.skills : ['Visual Architecture', 'Design Systems', 'Creative Strategy'];
        
        if (u.stats) {
          this.stats = { ...this.stats, ...u.stats };
          this.milestones = u.stats.milestones || [];
          this.portfolioItems = u.stats.portfolio || [];
        }
      }
    });
  }

  updateProfile() {
    this.isVerificationModalOpen = true;
  }

  confirmProfileUpdate() {
    if (!this.currentPassword) return;
    this.isSubmitting = true;
    const payload = {
      current_password: this.currentPassword,
      first_name: this.firstName,
      last_name: this.lastName,
      bio: this.bio
    };
    this.api.updateMe(payload).subscribe({
      next: () => {
        this.ui.notify('Profile updated successfully', 'success');
        this.isVerificationModalOpen = false;
        this.isSubmitting = false;
        this.loadProfile();
      },
      error: () => {
        this.ui.notify('Update failed', 'warn');
        this.isSubmitting = false;
      }
    });
  }

  openPasswordModal() {
    this.isPasswordModalOpen = true;
  }

  confirmPasswordUpdate() {
    this.isSubmitting = true;
    this.api.updateMe({ current_password: this.currentPassword, password: this.newPassword }).subscribe({
      next: () => {
        this.ui.notify('Password updated', 'success');
        this.isPasswordModalOpen = false;
        this.isSubmitting = false;
        this.currentPassword = '';
        this.newPassword = '';
      },
      error: () => {
        this.ui.notify('Password update failed', 'warn');
        this.isSubmitting = false;
      }
    });
  }

  getEmployeeID() { 
    if (this.user && (this.user.id || this.user._id)) {
      const id = this.user.id || this.user._id;
      return 'BS-' + id.substring(id.length - 4).toUpperCase();
    }
    return 'BS-9920'; 
  }
  getLocalTime() {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0') + ' GMT+1';
  }
}
