import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';

@Component({
  selector: 'app-admin-employees',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="animate-fade-up max-w-6xl mx-auto">
      <div *ngIf="errorMsg" class="mb-4 p-4 bg-rose-500/15 border border-rose-500/25 text-rose-300 rounded-2xl flex items-center justify-between text-sm shadow-md">
        <span class="flex items-center gap-2">
          <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          {{errorMsg}}
        </span>
        <button (click)="errorMsg=''" class="text-rose-400 hover:text-rose-200 font-bold ml-4">✕</button>
      </div>

      <div class="grid lg:grid-cols-12 gap-8">
        <!-- Form -->
        <div class="lg:col-span-5">
          <div class="bg-[#1b2a3a] border border-[#547792]/30 rounded-3xl p-7 shadow-lg">
            <h3 class="text-xs font-bold text-[#94B4C1] uppercase tracking-widest mb-6">Register Employee</h3>
            <form (ngSubmit)="createEmployee()" class="space-y-4">
              <div>
                <label class="text-[11px] text-[#94B4C1] uppercase tracking-wider font-bold block mb-1.5">Username</label>
                <input type="text" [(ngModel)]="empUsername" name="empUsername" placeholder="john_doe" required
                  class="w-full bg-[#213448]/50 border border-[#547792]/50 rounded-xl px-4 py-3 text-[#EAE0CF] placeholder-[#94B4C1]/50 focus:border-[#94B4C1] focus:outline-none transition-all text-sm">
              </div>
              <div>
                <label class="text-[11px] text-[#94B4C1] uppercase tracking-wider font-bold block mb-1.5">Email</label>
                <input type="email" [(ngModel)]="empEmail" name="empEmail" placeholder="john@company.com" required
                  class="w-full bg-[#213448]/50 border border-[#547792]/50 rounded-xl px-4 py-3 text-[#EAE0CF] placeholder-[#94B4C1]/50 focus:border-[#94B4C1] focus:outline-none transition-all text-sm">
              </div>
              <div>
                <label class="text-[11px] text-[#94B4C1] uppercase tracking-wider font-bold block mb-1.5">Password</label>
                <input type="password" [(ngModel)]="empPassword" name="empPassword" placeholder="Secure password" required
                  class="w-full bg-[#213448]/50 border border-[#547792]/50 rounded-xl px-4 py-3 text-[#EAE0CF] placeholder-[#94B4C1]/50 focus:border-[#94B4C1] focus:outline-none transition-all text-sm">
              </div>
              <div>
                <label class="text-[11px] text-[#94B4C1] uppercase tracking-wider font-bold block mb-1.5">Department</label>
                <select [(ngModel)]="empDepartmentId" name="empDepartmentId" required
                  class="w-full bg-[#213448]/50 border border-[#547792]/50 rounded-xl px-4 py-3 text-[#EAE0CF] focus:border-[#94B4C1] focus:outline-none transition-all text-sm cursor-pointer">
                  <option value="" disabled selected class="bg-[#1b2a3a]">Select department...</option>
                  <option *ngFor="let d of departments" [value]="d.id" class="bg-[#1b2a3a]">{{d.name}}</option>
                </select>
              </div>
              <button type="submit" [disabled]="isSubmitting"
                class="w-full bg-[#547792] hover:bg-[#94B4C1] hover:text-[#213448] text-[#EAE0CF] font-bold py-3 rounded-xl transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2 shadow-md">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>
                Register Account
              </button>
            </form>

            <div *ngIf="empSuccess" class="mt-5 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3">
              <div class="bg-emerald-500/20 p-2 rounded-full text-emerald-400">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
              </div>
              <div>
                <p class="text-sm text-emerald-300 font-semibold">Employee created!</p>
                <p class="text-xs text-emerald-500 mt-0.5">Account is now active.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Employee list -->
        <div class="lg:col-span-7 space-y-4">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-xs font-bold text-[#94B4C1] uppercase tracking-wider">Registered Staff</h3>
            <span class="bg-[#547792] text-[#EAE0CF] text-[10px] px-2.5 py-1 rounded-full font-black">{{employees.length}}</span>
          </div>



          <div *ngFor="let e of employees"
            class="bg-[#1b2a3a] border border-[#547792]/30 rounded-2xl p-5 flex items-center gap-4 hover:border-[#94B4C1]/50 transition-all shadow-sm">
            <div class="w-12 h-12 rounded-full bg-gradient-to-tr from-[#547792] to-[#94B4C1] flex items-center justify-center text-[#213448] font-black text-lg shrink-0">
              {{e.username.charAt(0).toUpperCase()}}
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-bold text-[#EAE0CF] text-sm">{{e.username}}</p>
              <p class="text-xs text-[#94B4C1] truncate opacity-75">{{e.email}}</p>
              <div class="flex items-center gap-2 mt-1.5">
                <span class="text-[10px] bg-[#547792]/20 text-[#94B4C1] border border-[#547792]/30 px-2 py-0.5 rounded-full font-semibold">
                  {{e.department_name || 'No Dept'}}
                </span>
              </div>
            </div>
            <span class="text-[10px] font-mono text-[#94B4C1] opacity-50 bg-[#213448] px-2 py-1 rounded-lg border border-[#547792]/50 shrink-0">
              {{e.id}}
            </span>
          </div>

          <div *ngIf="employees.length === 0"
            class="p-12 text-center border-2 border-dashed border-[#547792]/50 rounded-2xl text-[#94B4C1]">
            No employees registered yet.
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

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.api.getEmployees().subscribe({ next: (r: any) => { this.employees = r; }, error: () => {} });
    this.api.getDepartments().subscribe({ next: (r: any) => { this.departments = r; }, error: () => {} });
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
}
