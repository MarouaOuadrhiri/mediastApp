import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';

@Component({
  selector: 'app-admin-departments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="animate-fade-up max-w-6xl mx-auto">
      <!-- Error toast -->
      <div *ngIf="errorMsg" class="mb-4 p-4 bg-rose-500/15 border border-rose-500/25 text-rose-300 rounded-2xl flex items-center justify-between text-sm shadow-md">
        <span class="flex items-center gap-2">
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          {{errorMsg}}
        </span>
        <button (click)="errorMsg=''" class="text-rose-400 hover:text-rose-200 font-bold ml-4">✕</button>
      </div>

      <div class="grid lg:grid-cols-3 gap-8">
        <!-- Create form -->
        <div class="lg:col-span-1">
          <div class="bg-[#1b2a3a] border border-[#547792]/30 rounded-3xl p-7 sticky top-0 shadow-lg">
            <h3 class="text-xs font-bold text-[#94B4C1] uppercase tracking-widest mb-6">Create Department</h3>
            <form (ngSubmit)="createDepartment()" class="space-y-4">
              <div>
                <label class="text-[11px] text-[#94B4C1] uppercase tracking-wider font-bold block mb-1.5">Name</label>
                <input type="text" [(ngModel)]="depName" name="depName" placeholder="e.g. Engineering" required
                  class="w-full bg-[#213448]/50 border border-[#547792]/50 rounded-xl px-4 py-3 text-[#EAE0CF] placeholder-[#94B4C1]/50 focus:border-[#94B4C1] focus:outline-none transition-all text-sm">
              </div>
              <div>
                <label class="text-[11px] text-[#94B4C1] uppercase tracking-wider font-bold block mb-1.5">Description</label>
                <textarea [(ngModel)]="depDesc" name="depDesc" rows="3" placeholder="Brief description..."
                  class="w-full bg-[#213448]/50 border border-[#547792]/50 rounded-xl px-4 py-3 text-[#EAE0CF] placeholder-[#94B4C1]/50 focus:border-[#94B4C1] focus:outline-none transition-all text-sm resize-none"></textarea>
              </div>
              <button type="submit" [disabled]="isSubmitting"
                class="w-full bg-[#547792] hover:bg-[#94B4C1] hover:text-[#213448] text-[#EAE0CF] font-bold py-3 rounded-xl transition-all disabled:opacity-50 text-sm shadow-md">
                + Add Department
              </button>
            </form>
          </div>
        </div>

        <!-- List -->
        <div class="lg:col-span-2">
          <div class="grid sm:grid-cols-2 gap-4">
            <div *ngFor="let d of departments"
              class="bg-[#1b2a3a] border border-[#547792]/30 rounded-2xl p-6 hover:border-[#94B4C1]/50 transition-all group shadow-md hover:shadow-lg">
              <div class="flex justify-between items-start mb-3">
                <div class="w-10 h-10 rounded-xl bg-[#547792]/20 border border-[#547792]/40 flex items-center justify-center">
                  <svg class="w-5 h-5 text-[#94B4C1]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                </div>
                <span class="text-[9px] bg-[#213448] text-[#94B4C1] border border-[#547792]/50 px-2 py-1 rounded-lg font-mono">#{{(d.id || '').slice(-4)}}</span>
              </div>
              <h4 class="font-bold text-[#EAE0CF] text-base mb-1" *ngIf="editDepId !== d.id">{{d.name}}</h4>
              <input *ngIf="editDepId === d.id" type="text" [(ngModel)]="d.editName"
                class="w-full bg-[#213448] border border-[#547792] text-[#EAE0CF] px-2 py-1 rounded text-sm mb-1">
              <p class="text-xs text-[#94B4C1] leading-relaxed" *ngIf="editDepId !== d.id">{{d.description || 'No description.'}}</p>
              <textarea *ngIf="editDepId === d.id" [(ngModel)]="d.editDesc" rows="2"
                class="w-full bg-[#213448] border border-[#547792] text-[#EAE0CF] px-2 py-1 rounded text-xs mt-1"></textarea>
              <div class="flex gap-2 mt-4 justify-end">
                <button *ngIf="editDepId !== d.id" (click)="startEditDep(d)" class="text-xs text-[#94B4C1] hover:text-[#EAE0CF] font-bold">Edit</button>
                <button *ngIf="editDepId === d.id" (click)="saveEditDep(d)" class="text-xs text-green-400 hover:text-green-300 font-bold">Save</button>
                <button *ngIf="editDepId === d.id" (click)="editDepId = null" class="text-xs text-[#94B4C1] hover:text-[#EAE0CF] font-bold">Cancel</button>
              </div>
            </div>

            <div *ngIf="departments.length === 0"
              class="col-span-2 p-12 text-center border-2 border-dashed border-[#547792]/50 rounded-2xl text-[#94B4C1]">
              No departments yet. Create your first one.
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .animate-fade-up { animation: fadeUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  `]
})
export class DepartmentsComponent implements OnInit {
  departments: any[] = [];
  isSubmitting = false;
  errorMsg = '';

  depName = '';
  depDesc = '';
  editDepId: string | null = null;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.api.getDepartments().subscribe({ 
      next: (r: any) => { this.departments = r; }, 
      error: () => { } 
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
}
