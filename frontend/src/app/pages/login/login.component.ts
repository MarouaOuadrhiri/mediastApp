import { Component, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  username = '';
  password = '';
  isLoading = false;
  errorMsg = '';

  constructor(
    private api: ApiService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  login() {
    if (!this.username || !this.password) {
      this.errorMsg = 'Please enter your credentials.';
      return;
    }
    this.isLoading = true;
    this.errorMsg = '';
    this.api.login({ username: this.username, password: this.password }).subscribe({
      next: (res: any) => {
        if (isPlatformBrowser(this.platformId)) {
          localStorage.setItem('token', res.token);
          localStorage.setItem('role', res.role);
        }
        this.isLoading = false;
        if (res.role === 'ADMIN') {
          this.router.navigate(['/admin/dashboard']);
        } else if (res.role === 'EMPLOYEE') {
          this.router.navigate(['/employee/dashboard']);
        } else {
          // Fallback or generic dashboard
          this.router.navigate(['/login']);
        }
      },
      error: (err: any) => {
        this.errorMsg = err.error?.error || 'Invalid credentials. Please try again.';
        this.isLoading = false;
      }
    });
  }
}
