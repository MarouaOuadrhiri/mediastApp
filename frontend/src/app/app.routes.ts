import { Routes } from '@angular/router';
import { authGuard, adminGuard, employeeGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('./pages/login/login.component').then(c => c.LoginComponent) },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin.component').then(c => c.AdminComponent),
    canActivate: [authGuard, adminGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./pages/admin/dashboard/dashboard.component').then(c => c.DashboardComponent) },
      { path: 'departments', loadComponent: () => import('./pages/admin/departments/departments.component').then(c => c.DepartmentsComponent) },
      { path: 'employees', loadComponent: () => import('./pages/admin/employees/employees.component').then(c => c.EmployeesComponent) },
      { path: 'projects', loadComponent: () => import('./pages/admin/projects/projects.component').then(c => c.ProjectsComponent) },
      { path: 'tasks', loadComponent: () => import('./pages/admin/tasks/tasks.component').then(c => c.TasksComponent) },
      { path: 'analytics', loadComponent: () => import('./pages/admin/analytics/analytics.component').then(c => c.AnalyticsComponent) },
      { path: 'profile', loadComponent: () => import('./pages/profile/profile.component').then(c => c.ProfileComponent) }
    ]
  },
  {
    path: 'employee',
    loadComponent: () => import('./pages/employee/employee.component').then(c => c.EmployeeComponent),
    canActivate: [authGuard, employeeGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./pages/employee/dashboard/dashboard.component').then(c => c.DashboardComponent) },
      { path: 'profile', loadComponent: () => import('./pages/profile/profile.component').then(c => c.ProfileComponent) }
    ]
  }
];
