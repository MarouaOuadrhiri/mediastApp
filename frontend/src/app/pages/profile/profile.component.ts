import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

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
  
  isSubmitting = false;
  errorMsg = '';
  successMsg = '';

  constructor(private api: ApiService) {}

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

  updateProfile() {
    if (!this.currentPassword) {
      this.errorMsg = 'Current password is required to save changes.';
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
      profile_photo: this.profilePhoto
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
        // Optionally refresh page or notify parent layouts
        window.location.reload(); // Simple way to refresh layouts with new photo
      },
      error: (err) => {
        this.errorMsg = err.error?.error || 'Failed to update profile.';
        this.isSubmitting = false;
      }
    });
  }
}
