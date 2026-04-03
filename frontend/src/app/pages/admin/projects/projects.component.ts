import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';

@Component({
  selector: 'app-admin-projects',
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
        <!-- Project creation form -->
        <div class="lg:col-span-4">
          <div class="bg-[#1b2a3a] border border-[#547792]/30 rounded-3xl p-7 sticky top-0 shadow-lg max-h-[85vh] overflow-y-auto custom-scrollbar">
            <h3 class="text-xs font-bold text-[#EAE0CF] uppercase tracking-widest mb-6">{{ isEditingMode ? 'Edit Project' : 'Create & Assign Project' }}</h3>

            <form (ngSubmit)="submitProject()" class="space-y-4">
              <div>
                <label class="text-[11px] text-[#94B4C1] uppercase tracking-wider font-bold block mb-1.5">Project Name</label>
                <input type="text" [(ngModel)]="projectName" name="projectName" placeholder="e.g. Website Redesign" required
                  class="w-full bg-[#213448]/50 border border-[#547792]/50 rounded-xl px-4 py-3 text-[#EAE0CF] placeholder-[#94B4C1]/50 focus:border-[#EAE0CF] focus:outline-none transition-all text-sm">
              </div>
              <div>
                <label class="text-[11px] text-[#94B4C1] uppercase tracking-wider font-bold block mb-1.5">Description</label>
                <textarea [(ngModel)]="projectDesc" name="projectDesc" rows="2" placeholder="Project goals and scope..."
                  class="w-full bg-[#213448]/50 border border-[#547792]/50 rounded-xl px-4 py-3 text-[#EAE0CF] placeholder-[#94B4C1]/50 focus:border-[#EAE0CF] focus:outline-none transition-all text-sm resize-none"></textarea>
              </div>
              
              <div class="pt-2 border-t border-[#547792]/30">
                <label class="text-[11px] text-[#94B4C1] uppercase tracking-wider font-bold block mb-3">Project Assignment</label>
                
                <div class="space-y-3">
                  <div>
                    <span class="text-[10px] text-[#EAE0CF] font-medium block mb-1">Step 1: Select Department</span>
                    <select [(ngModel)]="projectDepartmentId" name="projectDepartmentId" (change)="onDepartmentChange()" required
                      class="w-full bg-[#213448]/50 border border-[#547792]/50 rounded-xl px-4 py-2.5 text-[#EAE0CF] focus:border-[#EAE0CF] focus:outline-none transition-all text-sm cursor-pointer">
                      <option value="" disabled selected class="bg-[#1b2a3a]">Select a department...</option>
                      <option *ngFor="let d of departments" [value]="d.id" class="bg-[#1b2a3a]">{{d.name}}</option>
                    </select>
                  </div>

                  <div *ngIf="projectDepartmentId" class="animate-fade-up">
                    <span class="text-[10px] text-[#EAE0CF] font-medium block mb-1">Step 2: Assign to Specific Employees (Optional)</span>
                    <select multiple [(ngModel)]="projectEmployeeIds" name="projectEmployeeIds"
                      class="w-full bg-[#213448]/50 border border-[#547792]/50 rounded-xl px-2 py-2 text-[#EAE0CF] focus:border-[#EAE0CF] focus:outline-none transition-all text-sm cursor-pointer h-32 custom-scrollbar">
                      <option *ngFor="let e of filteredEmployees" [value]="e.id" class="bg-[#213448] py-1 px-2 rounded mb-1">{{e.username}}</option>
                    </select>
                    <div class="flex flex-col gap-1 mt-1.5 pl-1">
                      <p class="text-[9px] text-[#94B4C1]/70 leading-tight">Hold Ctrl/Cmd to select multiple.</p>
                      <p class="text-[10px] text-emerald-400/80 font-medium leading-tight">💡 Leave empty to assign to all employees in this department.</p>
                    </div>
                  </div>

                  <div *ngIf="!projectDepartmentId" class="text-center py-4 border border-dashed border-[#547792]/20 rounded-xl">
                    <p class="text-[10px] text-[#94B4C1]/50">Please select a department first</p>
                  </div>
                </div>
              </div>

              <div class="pt-2 border-t border-[#547792]/30">
                <label class="text-[11px] text-[#94B4C1] uppercase tracking-wider font-bold block mb-1.5">Project Deadline</label>
                <input type="datetime-local" [(ngModel)]="projectDeadline" name="projectDeadline" required
                  class="w-full bg-[#213448]/50 border border-[#547792]/50 rounded-xl px-4 py-3 text-[#EAE0CF] focus:border-[#EAE0CF] focus:outline-none transition-all text-sm [color-scheme:dark]">
                <p class="text-[9px] text-[#94B4C1]/70 mt-1 pl-1">Task deadlines will be auto-calculated based on this.</p>
              </div>

              <!-- Tasks for this project -->
              <div class="pt-2 border-t border-[#547792]/30">
                <div class="flex items-center justify-between mb-2">
                  <label class="text-[11px] text-[#94B4C1] uppercase tracking-wider font-bold">Project Tasks</label>
                  <button type="button" (click)="addProjectTask()"
                    class="text-xs text-[#EAE0CF] hover:text-[#94B4C1] font-bold flex items-center gap-1">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 4v16m8-8H4"></path></svg>
                    Add Task
                  </button>
                </div>
                <div class="space-y-2">
                  <div *ngFor="let task of projectTasks; let i = index" class="flex gap-2">
                    <input type="text" [(ngModel)]="projectTasks[i].title" [name]="'pt_' + i"
                      placeholder="Task title..."
                      class="flex-1 bg-[#213448]/50 border border-[#547792]/50 rounded-lg px-3 py-2 text-[#EAE0CF] placeholder-[#94B4C1]/50 focus:border-[#EAE0CF] focus:outline-none transition-all text-xs">
                    <button type="button" (click)="removeProjectTask(i)" class="text-[#547792] hover:text-rose-400 transition-colors">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                  </div>
                  <div *ngIf="projectTasks.length === 0" class="text-center text-[10px] text-[#547792] py-3 border border-dashed border-[#547792]/30 rounded-xl">
                    No tasks added yet
                  </div>
                </div>
              </div>

              <div class="flex gap-3">
                <button *ngIf="isEditingMode" type="button" (click)="cancelEdit()"
                  class="w-1/3 bg-[#213448] hover:bg-[#2a4058] text-[#94B4C1] font-bold py-3 rounded-xl transition-all text-sm border border-[#547792]/30">
                  Cancel
                </button>
                <button type="submit" [disabled]="isSubmitting || projectTasks.length === 0"
                  class="flex-1 bg-[#547792] hover:bg-[#94B4C1] hover:text-[#213448] text-[#EAE0CF] font-bold py-3 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2 shadow-md">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                  {{ isEditingMode ? 'Save Changes' : 'Assign Project' }}
                </button>
              </div>
            </form>

            <div *ngIf="projectSuccess" class="mt-5 p-4 bg-[#94B4C1]/10 border border-[#94B4C1]/30 rounded-2xl flex items-center gap-3">
              <div class="bg-[#94B4C1]/20 p-2 rounded-full text-[#94B4C1]">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
              </div>
              <div>
                <p class="text-sm text-[#EAE0CF] font-semibold">{{ isEditingMode ? 'Project updated!' : 'Project assigned!' }}</p>
                <p class="text-xs text-[#94B4C1]/80 mt-0.5">Tasks successfully generated.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Projects list -->
        <div class="lg:col-span-8 space-y-4">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-xs font-bold text-[#94B4C1] uppercase tracking-wider">Active Projects</h3>
            <span class="bg-[#547792] text-[#EAE0CF] text-[10px] px-2.5 py-1 rounded-full font-black">{{projects.length}}</span>
          </div>



          <div *ngFor="let p of projects"
            class="bg-[#1b2a3a] border border-[#547792]/30 rounded-2xl overflow-hidden hover:border-[#94B4C1]/50 transition-all shadow-md">
            <!-- Project header -->
            <div class="flex items-start gap-4 p-5">
              <div class="w-10 h-10 rounded-xl bg-[#547792]/20 border border-[#547792]/40 flex items-center justify-center shrink-0">
                <svg class="w-5 h-5 text-[#94B4C1]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-3">
                  <h4 class="font-bold text-[#EAE0CF] text-sm">{{p.name}}</h4>
                  <div class="flex items-center gap-2 shrink-0">
                    <button (click)="editProject(p)" class="p-1.5 bg-[#547792]/20 text-[#94B4C1] hover:text-[#EAE0CF] hover:bg-[#547792]/40 rounded-lg transition-all" title="Edit">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                    </button>
                    <button (click)="deleteProject(p.id)" class="p-1.5 bg-rose-500/10 text-rose-400 hover:text-white hover:bg-rose-500/80 rounded-lg transition-all" title="Delete">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                    <span class="text-[9px] bg-[#213448] text-[#94B4C1] border border-[#547792]/50 px-2 py-1 rounded-lg font-mono ml-2">#{{p.id?.slice(-4)}}</span>
                  </div>
                </div>
                <p class="text-xs text-[#94B4C1]/80 mt-1 leading-relaxed">{{p.description || 'No description.'}}</p>
                <div class="flex items-center gap-2 mt-2.5">
                  <ng-container *ngIf="p.department_name; else multiEmp">
                    <span class="text-[10px] bg-[#547792]/20 text-[#94B4C1] border border-[#547792]/40 px-2 py-0.5 rounded-full font-medium">Department: {{p.department_name}}</span>
                  </ng-container>
                  <ng-template #multiEmp>
                    <span class="text-[10px] bg-[#547792]/20 text-[#94B4C1] border border-[#547792]/40 px-2 py-0.5 rounded-full font-medium">{{p.employees?.length || 0}} Users assigned</span>
                  </ng-template>
                  <span class="text-[#547792]">·</span>
                  <span class="text-[10px] text-[#94B4C1]/70">{{p.tasks?.length || 0}} tasks</span>
                  <span class="text-[#547792]" *ngIf="p.deadline">·</span>
                  <span class="text-[10px] font-bold text-rose-400" *ngIf="p.deadline">Due: {{p.deadline | date:'shortDate'}}</span>
                </div>
              </div>
            </div>

            <!-- Tasks list -->
            <div class="border-t border-[#547792]/20 px-5 pb-5 pt-4">
              <p class="text-[10px] uppercase tracking-wider text-[#94B4C1]/60 font-bold mb-3">Tasks</p>
              <div class="space-y-2">
                <div *ngFor="let t of p.tasks"
                  class="flex items-center gap-3 text-sm py-2 px-3 rounded-xl bg-[#213448]/30 border border-[#547792]/20">
                  <div class="w-2 h-2 rounded-full shrink-0"
                    [class]="t.status === 'DONE' ? 'bg-emerald-400' : t.status === 'IN_PROGRESS' ? 'bg-[#94B4C1]' : 'bg-[#547792]'">
                  </div>
                  <span class="flex-1 text-[#EAE0CF] text-xs">
                    {{t.title}}
                    <span *ngIf="t.deadline" class="ml-2 text-[9px] text-[#94B4C1]/60 font-mono">(Due {{t.deadline | date:'shortDate'}})</span>
                  </span>
                  <span class="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    [class]="t.status === 'DONE' ? 'bg-emerald-500/15 text-emerald-400' : t.status === 'IN_PROGRESS' ? 'bg-[#94B4C1]/15 text-[#94B4C1]' : 'bg-[#547792]/20 text-[#547792]'">
                    {{t.status?.replace('_', ' ')}}
                  </span>
                </div>
              </div>

              <!-- Progress bar -->
              <div class="mt-4" *ngIf="p.tasks?.length > 0">
                <div class="flex justify-between text-[10px] text-[#94B4C1]/70 mb-1.5">
                  <span>Progress</span>
                  <span>{{getProjectProgress(p)}}%</span>
                </div>
                <div class="h-1.5 bg-[#213448] rounded-full overflow-hidden">
                  <div class="h-full bg-gradient-to-r from-[#547792] to-[#94B4C1] rounded-full transition-all duration-700"
                    [style.width]="getProjectProgress(p) + '%'"></div>
                </div>
              </div>
            </div>
          </div>

          <div *ngIf="projects.length === 0"
            class="p-12 text-center border-2 border-dashed border-[#547792]/50 rounded-2xl text-[#94B4C1] flex flex-col items-center gap-3">
            <svg class="w-10 h-10 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
            No projects assigned yet.
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .animate-fade-up { animation: fadeUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(84, 119, 146, 0.3); border-radius: 20px; }
  `]
})
export class ProjectsComponent implements OnInit {
  projects: any[] = [];
  employees: any[] = [];
  departments: any[] = [];
  isSubmitting = false;
  errorMsg = '';

  projectName = '';
  projectDesc = '';
  projectDepartmentId = '';
  projectEmployeeIds: string[] = [];
  projectDeadline = '';
  
  projectTasks: { id?: string, title: string, description?: string }[] = [];
  projectSuccess = false;
  
  filteredEmployees: any[] = [];
  isEditingMode = false;
  editingProjectId = '';

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.api.getProjects().subscribe({ next: (r: any) => { this.projects = r; }, error: () => {} });
    this.api.getEmployees().subscribe({ next: (r: any) => { this.employees = r; this.filterEmployees(); }, error: () => {} });
    this.api.getDepartments().subscribe({ next: (r: any) => { this.departments = r; }, error: () => {} });
  }

  filterEmployees() {
    if (!this.projectDepartmentId) {
      this.filteredEmployees = [];
    } else {
      this.filteredEmployees = this.employees.filter(e => e.department_id === this.projectDepartmentId);
    }
  }

  onDepartmentChange() {
    this.projectEmployeeIds = [];
    this.filterEmployees();
  }

  getProjectProgress(p: any): number {
    if (!p.tasks || p.tasks.length === 0) return 0;
    const done = p.tasks.filter((t: any) => t.status === 'DONE').length;
    return Math.round((done / p.tasks.length) * 100);
  }

  addProjectTask() { this.projectTasks.push({ title: '' }); }
  removeProjectTask(i: number) { this.projectTasks.splice(i, 1); }

  editProject(p: any) {
    this.isEditingMode = true;
    this.editingProjectId = p.id;
    this.projectName = p.name;
    this.projectDesc = p.description || '';
    this.projectDepartmentId = p.department_id || '';
    this.filterEmployees();
    this.projectEmployeeIds = p.employees?.map((e: any) => e.id) || [];
    this.projectDeadline = p.deadline ? p.deadline.slice(0, 16) : '';
    this.projectTasks = p.tasks?.map((t: any) => ({ id: t.id, title: t.title, description: t.description })) || [];
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit() {
    this.isEditingMode = false;
    this.editingProjectId = '';
    this.projectName = ''; this.projectDesc = ''; 
    this.projectDepartmentId = ''; this.projectEmployeeIds = [];
    this.filteredEmployees = [];
    this.projectDeadline = ''; this.projectTasks = [];
    this.errorMsg = '';
  }

  deleteProject(id: string) {
    if(confirm('Are you sure you want to delete this project?')) {
      this.api.deleteProject(id).subscribe({
        next: () => this.loadData(),
        error: () => alert('Failed to delete project')
      });
    }
  }

  submitProject() {
    this.errorMsg = '';
    
    if (!this.projectName || this.projectTasks.length === 0 || !this.projectDeadline) {
      this.errorMsg = 'Please fill all required fields, set a deadline and add at least one task.'; return;
    }
    
    if (!this.projectDepartmentId && this.projectEmployeeIds.length === 0) {
      this.errorMsg = 'Please assign to a department or select at least one employee.'; return;
    }

    const validTasks = this.projectTasks.filter(t => t.title.trim());
    if (validTasks.length === 0) { this.errorMsg = 'Please add valid task titles.'; return; }

    // Format deadline to ISO
    let deadlineIso = '';
    try {
      deadlineIso = new Date(this.projectDeadline).toISOString();
    } catch {
      this.errorMsg = 'Invalid date format.'; return;
    }

    this.isSubmitting = true;
    const payload = {
      name: this.projectName,
      description: this.projectDesc,
      department_id: this.projectDepartmentId || undefined,
      employee_ids: this.projectEmployeeIds,
      deadline: deadlineIso,
      tasks: validTasks
    };

    const req = this.isEditingMode 
      ? this.api.updateProject(this.editingProjectId, payload)
      : this.api.createProject(payload);

    req.subscribe({
      next: () => {
        this.cancelEdit();
        this.projectSuccess = true;
        this.isSubmitting = false;
        
        setTimeout(() => this.projectSuccess = false, 4000);
        this.loadData();
      },
      error: (err: any) => {
        this.errorMsg = err.error?.error || 'Failed to save project.';
        this.isSubmitting = false;
      }
    });
  }
}
