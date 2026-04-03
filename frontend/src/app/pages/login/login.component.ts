import { Component, OnInit, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl:'./login.component.html', 
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  username = '';
  password = '';
  loading = false;
  error = '';

  constructor(private api: ApiService, private router: Router, @Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('token');
      const role = localStorage.getItem('role');
      if (token) {
        if (role === 'ADMIN') this.router.navigate(['/admin']);
        else this.router.navigate(['/employee']);
      }
    }
  }

  login() {
    if (!this.username || !this.password) {
      this.error = 'Please enter both username and password.';
      return;
    }
    this.loading = true;
    this.error = '';
    this.api.login({ username: this.username, password: this.password }).subscribe({
      next: (res: any) => {
        localStorage.setItem('token', res.token);
        localStorage.setItem('role', res.role);
        if (res.role === 'ADMIN') this.router.navigate(['/admin']);
        else this.router.navigate(['/employee']);
      },
      error: () => {
        this.loading = false;
        this.error = 'Invalid credentials. Please try again.';
      }
    });
  }
}
