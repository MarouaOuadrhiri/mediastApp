import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';

@Component({
  selector: 'app-admin-employees',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './employees.component.html',
  styleUrls: ['./employees.component.css']
})
export class EmployeesComponent implements OnInit {
  employees: any[] = [];
  departments: any[] = [];
  isSubmitting = false;
  errorMsg = '';
  selectedDepartmentId = '';
  isDeptDropdownOpen = false;

  // Pagination
  currentPage = 1;
  itemsPerPage = 6;

  empFirstName = '';
  empLastName = '';
  empEmail = '';
  empPassword = '';
  empDepartmentId = '';
  empSuccess = '';
  empPhoto = '';
  empBio = '';

  isModalOpen = false;
  showHistoryModal = false;
  activeProfileTab: 'OVERVIEW' | 'PROJECTS' | 'ATTENDANCE' = 'OVERVIEW';
  selectedHistory: any = null;

  showAttendanceModal = false;
  selectedAttendanceLogs: any[] = [];
  selectedEmpName = '';

  isConfirmingPassword = false;
  adminPassword = '';
  confirmPasswordError = '';

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone
  ) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.api.getEmployees().subscribe({ 
      next: (r: any) => { 
        this.zone.run(() => {
          this.employees = r; 
          this.cdr.detectChanges();
        });
      }, 
      error: () => {} 
    });
    this.api.getDepartments().subscribe({ 
      next: (r: any) => { 
        this.zone.run(() => {
          this.departments = r; 
          this.cdr.detectChanges();
        });
      }, 
      error: () => {} 
    });
  }

  createEmployee() {
    if (!this.empFirstName || !this.empLastName || !this.empEmail || !this.empPassword || !this.empDepartmentId) {
      this.errorMsg = 'Please fill all fields.'; return;
    }
    this.isConfirmingPassword = true;
    this.adminPassword = '';
    this.confirmPasswordError = '';
  }

  confirmAction() {
    if (!this.adminPassword) {
      this.confirmPasswordError = 'Password is required.';
      return;
    }

    this.isSubmitting = true;
    this.api.verifyPassword(this.adminPassword).subscribe({
      next: (res) => {
        if (res.success) {
          this.executeCreateEmployee();
        } else {
          this.confirmPasswordError = 'Incorrect password.';
          this.isSubmitting = false;
        }
      },
      error: (err) => {
        this.confirmPasswordError = err.error?.error || 'Verification failed.';
        this.isSubmitting = false;
      }
    });
  }

  executeCreateEmployee() {
    this.api.createEmployee({ 
      first_name: this.empFirstName,
      last_name: this.empLastName,
      email: this.empEmail, 
      password: this.empPassword, 
      department_id: this.empDepartmentId,
      profile_photo: this.empPhoto,
      bio: this.empBio
    }).subscribe({
      next: (res: any) => { 
        this.empSuccess = res.id; 
        this.empFirstName = ''; this.empLastName = ''; this.empEmail = ''; this.empPassword = ''; this.empDepartmentId = ''; this.empPhoto = ''; this.empBio = '';
        this.isSubmitting = false; 
        this.loadData(); 
        this.closeModal();
        setTimeout(() => this.empSuccess = '', 3000);
      },
      error: (err: any) => { 
        this.errorMsg = err.error?.error || 'Failed to create employee.'; 
        this.isSubmitting = false; 
        this.isConfirmingPassword = false;
      }
    });
  }

  openHistory(emp: any) {
    // Pre-populate header immediately
    this.selectedHistory = { user: emp, projects: [], standalone_tasks: [], attendance: [] };
    this.showHistoryModal = true;
    
    // Load History
    this.api.getEmployeeHistory(emp.id).subscribe({
      next: (res: any) => {
        setTimeout(() => { 
          if (this.selectedHistory) {
            this.selectedHistory = { ...this.selectedHistory, ...res };
          }
        }, 0);
      }
    });

    // Load Attendance (Pointage)
    this.api.getEmployeeAttendance(emp.id).subscribe({
      next: (res: any) => {
        setTimeout(() => {
          if (this.selectedHistory) {
            this.selectedHistory.attendance = res;
          }
        }, 0);
      }
    });
  }

  closeHistory() {
    this.showHistoryModal = false;
    this.selectedHistory = null;
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.empPhoto = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  openAttendance(emp: any) {
    this.selectedEmpName = emp.first_name ? `${emp.first_name} ${emp.last_name}` : emp.username;
    this.selectedAttendanceLogs = [];
    this.showAttendanceModal = true;
    this.api.getEmployeeAttendance(emp.id).subscribe({
      next: (res: any) => {
        this.selectedAttendanceLogs = res;
      },
      error: () => {
        this.errorMsg = 'Failed to load attendance logs.';
      }
    });
  }

  closeAttendance() {
    this.showAttendanceModal = false;
    this.selectedAttendanceLogs = [];
  }

  openModal() {
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
    this.errorMsg = '';
    this.isConfirmingPassword = false;
    this.adminPassword = '';
    this.confirmPasswordError = '';
  }

  get filteredEmployees() {
    let list = this.employees;
    if (this.selectedDepartmentId) {
      list = list.filter(e => e.department_id === this.selectedDepartmentId);
    }
    return list;
  }

  get paginatedEmployees() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredEmployees.slice(startIndex, startIndex + this.itemsPerPage);
  }

  get totalPages() {
    return Math.ceil(this.filteredEmployees.length / this.itemsPerPage);
  }

  get pagesArray() {
    const total = this.totalPages;
    const limit = Math.min(total, 5);
    const pages = [];
    for (let i = 1; i <= limit; i++) {
      pages.push(i);
    }
    return pages;
  }

  selectDepartment(id: string) {
    this.selectedDepartmentId = id;
    this.currentPage = 1;
    this.isDeptDropdownOpen = false;
  }

  getSelectedDeptName() {
    const dept = this.departments.find(d => d.id === this.selectedDepartmentId);
    return dept ? dept.name : 'All Departments';
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  setPage(page: number) {
    this.currentPage = page;
  }

  getInitials(name: string): string {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  get groupedAttendance() {
    if (!this.selectedHistory?.attendance) return [];
    
    const groups: { [key: string]: any } = {};
    
    this.selectedHistory.attendance.forEach((log: any) => {
      const dateKey = new Date(log.start_time).toDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = {
          date: dateKey,
          totalSeconds: 0,
          sessions: 0,
          rawDate: new Date(log.start_time)
        };
      }
      
      groups[dateKey].sessions++;
      if (log.duration && log.duration !== 'Ongoing') {
        groups[dateKey].totalSeconds += this.parseDurationToSeconds(log.duration);
      }
    });

    return Object.values(groups).sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());
  }

  get weeklyTotal() {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    let totalSeconds = 0;
    
    this.groupedAttendance.forEach(group => {
      if (group.rawDate >= oneWeekAgo) {
        totalSeconds += group.totalSeconds;
      }
    });
    
    return this.formatSecondsToDuration(totalSeconds);
  }

  parseDurationToSeconds(duration: string): number {
    if (!duration) return 0;
    const parts = duration.split(':').map(Number);
    if (parts.length === 3) {
      return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    }
    return 0;
  }

  formatSecondsToDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
}
