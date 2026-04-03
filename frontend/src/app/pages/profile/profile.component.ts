import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})

export class ProfileComponent implements OnInit {
  user: any = null;
  updUsername = '';
  updEmail = '';
  updPassword = '';
  currentPass = '';
  
  successMsg = '';
  errorMsg = '';
  isSubmitting = false;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getMe().subscribe({
      next: (r: any) => {
        this.user = r;
        this.updUsername = r.username;
        this.updEmail = r.email;
      },
      error: () => { this.errorMsg = 'Failed to load profile data.'; }
    });
  }

  updateProfile() {
    this.errorMsg = '';
    this.successMsg = '';
    
    if (!this.currentPass) {
      this.errorMsg = 'Current password is required to save changes.';
      return;
    }

    this.isSubmitting = true;
    const payload: any = {
      username: this.updUsername,
      email: this.updEmail,
      current_password: this.currentPass
    };
    
    if (this.updPassword) {
      payload.password = this.updPassword;
    }

    this.api.updateMe(payload).subscribe({
      next: (r: any) => {
        this.successMsg = 'Profile updated successfully!';
        this.user = r.user;
        this.currentPass = '';
        this.updPassword = '';
        this.isSubmitting = false;
        setTimeout(() => this.successMsg = '', 5000);
      },
      error: (err: any) => {
        this.errorMsg = err.error?.error || 'Failed to update profile.';
        this.isSubmitting = false;
      }
    });
  }
}
