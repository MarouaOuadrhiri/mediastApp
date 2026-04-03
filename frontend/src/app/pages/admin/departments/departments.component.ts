import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';

@Component({
  selector: 'app-admin-departments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './departments.component.html',
  styleUrls: ['./departments.component.css']
})
export class DepartmentsComponent implements OnInit {
  departments: any[] = [];
  selectedDep: any = null;
  isLoadingDetail = false;
  isSubmitting = false;
  errorMsg = '';

  depName = '';
  depDesc = '';
  editDepId: string | null = null;

  showHistoryModal = false;
  selectedHistory: any = null;

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.api.getDepartments().subscribe({ 
      next: (r: any) => { 
        setTimeout(() => {
          this.departments = r; 
        }, 0);
      }, 
      error: () => { } 
    });
  }

  viewDetail(d: any) {
    if (this.editDepId) return; // Don't trigger if editing
    this.isLoadingDetail = true;
    this.api.getDepartment(d.id).subscribe({
      next: (res: any) => {
        this.selectedDep = res;
        this.isLoadingDetail = false;
      },
      error: (err: any) => {
        this.errorMsg = 'Failed to load department details.';
        this.isLoadingDetail = false;
      }
    });
  }

  createDepartment() {
    if (!this.depName) { this.errorMsg = 'Department name is required.'; return; }
    this.isSubmitting = true;
    this.api.createDepartment({ name: this.depName, description: this.depDesc }).subscribe({
      next: () => { this.depName = ''; this.depDesc = ''; this.isSubmitting = false; this.loadData(); },
      error: (err: any) => { this.errorMsg = err.error?.error || 'Failed to create department.'; this.isSubmitting = false; }
    });
  }

  startEditDep(d: any) { this.editDepId = d.id; d.editName = d.name; d.editDesc = d.description; }
  saveEditDep(d: any) {
    this.api.updateDepartment(d.id, { name: d.editName, description: d.editDesc }).subscribe({
      next: () => { this.editDepId = null; this.loadData(); },
      error: (err: any) => { this.errorMsg = err.error?.error || 'Failed to update.'; }
    });
  }

  openEmployeeHistory(emp: any) {
    // Pre-populate with basic info and clear previous data
    this.selectedHistory = { user: emp, projects: [], standalone_tasks: [] };
    this.showHistoryModal = true;
    this.api.getEmployeeHistory(emp.id).subscribe({
      next: (res: any) => {
        console.log('Department Employee History Data:', res);
        setTimeout(() => {
          this.selectedHistory = res;
          this.cdr.detectChanges();
        }, 0);
      },
      error: () => {
        this.errorMsg = 'Failed to load employee history details.';
      }
    });
  }

  closeHistory() {
    this.showHistoryModal = false;
    this.selectedHistory = null;
  }
}
