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
  depSubtitle = '';
  depDesc = '';
  depIcon = '';
  depImage = '';          // base64 string sent to backend
  depImagePreview = '';   // data URL shown in preview
  editDepId: string | null = null;

  isModalOpen = false;
  showHistoryModal = false;
  selectedHistory: any = null;

  totalWorkforce = 0;
  activeEntities = 0;

  defaultIcon = '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>';

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.api.getDepartments().subscribe({ 
      next: (r: any) => { 
        this.departments = r; 
        this.activeEntities = r.length;
        this.totalWorkforce = r.reduce((acc: number, d: any) => acc + (d.employees_count || 0), 0);
        this.cdr.detectChanges();
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

  openModal(d: any = null) {
    if (d) {
      this.editDepId = d.id;
      this.depName = d.name;
      this.depSubtitle = d.subtitle;
      this.depDesc = d.description;
      this.depIcon = d.icon;
      this.depImage = d.image || '';
      this.depImagePreview = d.image ? `data:image/jpeg;base64,${d.image}` : '';
    } else {
      this.editDepId = null;
      this.depName = '';
      this.depSubtitle = '';
      this.depDesc = '';
      this.depIcon = '';
      this.depImage = '';
      this.depImagePreview = '';
    }
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
    this.editDepId = null;
    this.depImage = '';
    this.depImagePreview = '';
  }

  submitDepartment() {
    if (!this.depName) { this.errorMsg = 'Department name is required.'; return; }
    this.isSubmitting = true;
    const data = { 
      name: this.depName, 
      subtitle: this.depSubtitle,
      description: this.depDesc, 
      icon: this.depIcon,
      image: this.depImage
    };

    if (this.editDepId) {
      this.api.updateDepartment(this.editDepId, data).subscribe({
        next: () => { this.postSubmit(); },
        error: (err: any) => { this.errorMsg = err.error?.error || 'Failed to update department.'; this.isSubmitting = false; }
      });
    } else {
      this.api.createDepartment(data).subscribe({
        next: () => { this.postSubmit(); },
        error: (err: any) => { this.errorMsg = err.error?.error || 'Failed to create department.'; this.isSubmitting = false; }
      });
    }
  }

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result is "data:image/jpeg;base64,XXXX" — extract only the base64 part
      this.depImagePreview = result;
      this.depImage = result.split(',')[1];
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  postSubmit() {
    this.isSubmitting = false;
    this.closeModal();
    this.loadData();
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
