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
  isVerificationModalOpen = false;
  isPasswordModalOpen = false;
  currentPassword = '';
  newPassword = '';
  confirmNewPassword = '';

  skills = [
    'Visual Architecture',
    'Design Systems',
    'Creative Strategy',
    '3D Motion',
    'UX Research',
    'Prototyping'
  ];

  milestones = [
    { date: 'Tomorrow', title: 'Nexus UI Audit', project: 'Project: Quantum Shift', current: true },
    { date: 'Aug 18', title: 'Design System V2.1', project: 'Core Assets Library', current: false },
    { date: 'Aug 22', title: 'Mentorship Session', project: 'Internal Studio', current: false }
  ];

  portfolioItems = [
    { image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&h=300' },
    { image: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?auto=format&fit=crop&w=400&h=300' }
  ];

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
      next: (u) => {
        this.user = u;
        this.firstName = u.first_name || '';
        this.lastName = u.last_name || '';
        this.email = u.email;
        this.profilePhoto = u.profile_photo || '';
        this.bio = u.bio || '';
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
    if (this.newPassword !== this.confirmNewPassword) return;
    this.isSubmitting = true;
    this.api.updateMe({ current_password: this.currentPassword, password: this.newPassword }).subscribe({
      next: () => {
        this.ui.notify('Password updated', 'success');
        this.isPasswordModalOpen = false;
        this.isSubmitting = false;
      },
      error: () => {
        this.ui.notify('Password update failed', 'warn');
        this.isSubmitting = false;
      }
    });
  }

  getEmployeeID() { return 'BS-9920'; }
  getGlobalPoints() { return 92; }
  getEfficiency() { return 98; }
  getFeedbackScore() { return 4.9; }
  getSprintLoad() { return 74; }
  getWeeklyHours() { return 32; }
  getLeadTime() { return 1.4; }
  getTenure() { return '4.2 Years'; }
  getLocalTime() {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0') + ' GMT+1';
  }
}
