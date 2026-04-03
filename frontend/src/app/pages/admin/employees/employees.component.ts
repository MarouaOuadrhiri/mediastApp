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

  empUsername = '';
  empEmail = '';
  empPassword = '';
  empDepartmentId = '';
  empSuccess = '';

  showHistoryModal = false;
  selectedHistory: any = null;

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
    if (!this.empUsername || !this.empEmail || !this.empPassword || !this.empDepartmentId) {
      this.errorMsg = 'Please fill all fields.'; return;
    }
    this.isSubmitting = true;
    this.api.createEmployee({ username: this.empUsername, email: this.empEmail, password: this.empPassword, department_id: this.empDepartmentId }).subscribe({
      next: (res: any) => { 
        this.empSuccess = res.id; 
        this.empUsername = ''; this.empEmail = ''; this.empPassword = ''; this.empDepartmentId = ''; 
        this.isSubmitting = false; 
        this.loadData(); 
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
}
