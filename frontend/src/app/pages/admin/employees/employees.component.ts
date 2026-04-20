import { Component, OnInit } from '@angular/core';
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

  isModalOpen = false;
  showHistoryModal = false;
  selectedHistory: any = null;

  showAttendanceModal = false;
  selectedAttendanceLogs: any[] = [];
  selectedEmpName = '';

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.api.getEmployees().subscribe({ 
      next: (r: any) => { 
        setTimeout(() => { this.employees = r; }, 0);
      }, 
      error: () => {} 
    });
    this.api.getDepartments().subscribe({ 
      next: (r: any) => { 
        setTimeout(() => { this.departments = r; }, 0);
      }, 
      error: () => {} 
    });
  }

  createEmployee() {
    if (!this.empFirstName || !this.empLastName || !this.empEmail || !this.empPassword || !this.empDepartmentId) {
      this.errorMsg = 'Please fill all fields.'; return;
    }
    this.isSubmitting = true;
    this.api.createEmployee({ 
      first_name: this.empFirstName,
      last_name: this.empLastName,
      email: this.empEmail, 
      password: this.empPassword, 
      department_id: this.empDepartmentId,
      profile_photo: this.empPhoto
    }).subscribe({
      next: (res: any) => { 
        this.empSuccess = res.id; 
        this.empFirstName = ''; this.empLastName = ''; this.empEmail = ''; this.empPassword = ''; this.empDepartmentId = ''; this.empPhoto = '';
        this.isSubmitting = false; 
        this.loadData(); 
        this.closeModal();
        setTimeout(() => this.empSuccess = '', 3000);
      },
      error: (err: any) => { this.errorMsg = err.error?.error || 'Failed to create employee.'; this.isSubmitting = false; }
    });
  }

  openHistory(emp: any) {
    // Pre-populate header immediately with available employee data
    this.selectedHistory = { user: emp, projects: [], standalone_tasks: [] };
    this.showHistoryModal = true;
    this.api.getEmployeeHistory(emp.id).subscribe({
      next: (res: any) => {
        console.log('Employee History Data:', res);
        setTimeout(() => {
          this.selectedHistory = res;
        }, 0);
      },
      error: () => {
        this.errorMsg = 'Failed to load employee history.';
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
    const pages = [];
    for (let i = 1; i <= this.totalPages; i++) {
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
}
