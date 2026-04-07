import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = 'http://127.0.0.1:8000/api';
  constructor(private http: HttpClient) {}

  login(credentials: any): Observable<any> { return this.http.post(`${this.baseUrl}/users/login/`, credentials); }

  // Profile — any authenticated user
  getMe(): Observable<any> { return this.http.get(`${this.baseUrl}/users/me/`); }
  updateMe(data: any): Observable<any> { return this.http.patch(`${this.baseUrl}/users/me/`, data); }

  // Employee management (admin)
  getEmployees(): Observable<any> { return this.http.get(`${this.baseUrl}/users/employees/`); }
  createEmployee(data: any): Observable<any> { return this.http.post(`${this.baseUrl}/users/employees/`, data); }
  updateEmployee(id: string, data: any): Observable<any> { return this.http.patch(`${this.baseUrl}/users/employees/${id}/`, data); }
  deleteEmployee(id: string): Observable<any> { return this.http.delete(`${this.baseUrl}/users/employees/${id}/`); }
  getEmployeeHistory(id: string): Observable<any> { return this.http.get(`${this.baseUrl}/users/employees/${id}/history/`); }

  // Departments
  getDepartments(): Observable<any> { return this.http.get(`${this.baseUrl}/departments/`); }
  getDepartment(id: string): Observable<any> { return this.http.get(`${this.baseUrl}/departments/${id}/`); }
  createDepartment(data: any): Observable<any> { return this.http.post(`${this.baseUrl}/departments/`, data); }
  updateDepartment(id: string, data: any): Observable<any> { return this.http.put(`${this.baseUrl}/departments/${id}/`, data); }

  // Tasks
  getTasks(): Observable<any> { return this.http.get(`${this.baseUrl}/tasks/`); }
  createTask(data: any): Observable<any> { return this.http.post(`${this.baseUrl}/tasks/`, data); }
  updateTask(id: string, data: any): Observable<any> { return this.http.put(`${this.baseUrl}/tasks/${id}/`, data); }
  updateTaskStatus(id: string, status: string): Observable<any> { return this.http.patch(`${this.baseUrl}/tasks/${id}/status/`, { status }); }

  // Projects
  getProjects(): Observable<any> { return this.http.get(`${this.baseUrl}/projects/`); }
  getMyProjects(): Observable<any> { return this.http.get(`${this.baseUrl}/projects/my/`); }
  createProject(data: any): Observable<any> { return this.http.post(`${this.baseUrl}/projects/`, data); }
  updateProject(id: string, data: any): Observable<any> { return this.http.put(`${this.baseUrl}/projects/${id}/`, data); }
  deleteProject(id: string): Observable<any> { return this.http.delete(`${this.baseUrl}/projects/${id}/`); }
  updateProjectTaskStatus(projectId: string, taskId: string, status: string): Observable<any> {
    return this.http.patch(`${this.baseUrl}/projects/${projectId}/tasks/${taskId}/status/`, { status });
  }

  // Attendance
  getCurrentAttendance(): Observable<any> { return this.http.get(`${this.baseUrl}/users/attendance/current/`); }
  endAttendance(): Observable<any> { return this.http.post(`${this.baseUrl}/users/attendance/end/`, {}); }
  getEmployeeAttendance(userId: string): Observable<any> { return this.http.get(`${this.baseUrl}/users/employees/${userId}/attendance/`); }

  // Meetings
  getMeetings(): Observable<any> { return this.http.get(`${this.baseUrl}/meetings/`); }
  createMeeting(data: any): Observable<any> { return this.http.post(`${this.baseUrl}/meetings/create/`, data); }
}
