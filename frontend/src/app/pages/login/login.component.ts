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
  email = '';
  password = '';
  isLoading = false;
  errorMsg = '';
  viewMode: 'selection' | 'agent' | 'admin' = 'selection';

  constructor(
    private api: ApiService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  setMode(mode: 'agent' | 'admin' | 'selection') {
    this.viewMode = mode;
    this.errorMsg = '';
    this.email = '';
    this.password = '';
  }

  login() {
    if (!this.email || !this.password) {
      this.errorMsg = 'Please enter your credentials.';
      return;
    }
    this.isLoading = true;
    this.errorMsg = '';
    this.api.login({ email: this.email, password: this.password }).subscribe({
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
