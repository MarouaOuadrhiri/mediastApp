import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="animate-fade-up max-w-4xl mx-auto py-4">
      <div class="flex items-center gap-4 mb-8">
        <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#547792] to-[#94B4C1] flex items-center justify-center shadow-xl shadow-[#547792]/20">
          <svg class="w-8 h-8 text-[#213448]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
        </div>
        <div>
          <h2 class="text-2xl font-black text-[#EAE0CF]">My Profile</h2>
          <p class="text-sm text-[#94B4C1]">Manage your personal information and account security</p>
        </div>
      </div>

      <div class="grid lg:grid-cols-3 gap-8">
        <!-- Sidebar Info -->
        <div class="lg:col-span-1 space-y-4">
          <div class="bg-[#1b2a3a] border border-[#547792]/30 rounded-3xl p-6 shadow-lg">
            <h3 class="text-[10px] uppercase tracking-widest text-[#94B4C1] font-bold mb-6">Account Details</h3>
            
            <div class="space-y-4">
              <div>
                <p class="text-[9px] uppercase tracking-wider text-[#94B4C1]/60 font-bold mb-1">Role</p>
                <span class="inline-block px-3 py-1 rounded-full bg-[#547792]/20 text-[#94B4C1] border border-[#547792]/40 text-xs font-black uppercase tracking-wider">
                  {{user?.role || 'User'}}
                </span>
              </div>
              
              <div *ngIf="user?.department_name">
                <p class="text-[9px] uppercase tracking-wider text-[#94B4C1]/60 font-bold mb-1">Department</p>
                <p class="text-sm font-bold text-[#EAE0CF]">{{user.department_name}}</p>
              </div>

              <div>
                <p class="text-[9px] uppercase tracking-wider text-[#94B4C1]/60 font-bold mb-1">Account Created</p>
                <p class="text-sm font-bold text-[#EAE0CF]">Managing Workspace</p>
              </div>
            </div>
          </div>

          <div class="bg-gradient-to-br from-[#547792]/10 to-transparent border border-[#547792]/20 rounded-3xl p-6">
            <p class="text-xs text-[#94B4C1] leading-relaxed italic">
              "Keep your contact information up-to-date to ensure you receive all project notifications and workspace updates."
            </p>
          </div>
        </div>

        <!-- Update Form -->
        <div class="lg:col-span-2">
          <div class="bg-[#1b2a3a] border border-[#547792]/30 rounded-3xl p-8 shadow-lg">
            <form (ngSubmit)="updateProfile()" class="space-y-6">
              <div *ngIf="successMsg" class="p-4 bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 rounded-2xl flex items-center gap-3 text-sm animate-fade-up">
                <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                {{successMsg}}
              </div>

              <div *ngIf="errorMsg" class="p-4 bg-rose-500/15 border border-rose-500/25 text-rose-300 rounded-2xl flex items-center gap-3 text-sm animate-fade-up">
                <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                {{errorMsg}}
              </div>

              <div class="grid md:grid-cols-2 gap-6">
                <div>
                  <label class="text-[11px] text-[#94B4C1] uppercase tracking-wider font-bold block mb-2">Username</label>
                  <input type="text" [(ngModel)]="updUsername" name="updUsername"
                    class="w-full bg-[#213448]/50 border border-[#547792]/50 rounded-xl px-4 py-3 text-[#EAE0CF] focus:border-[#EAE0CF] focus:outline-none transition-all text-sm">
                </div>
                <div>
                  <label class="text-[11px] text-[#94B4C1] uppercase tracking-wider font-bold block mb-2">Email Address</label>
                  <input type="email" [(ngModel)]="updEmail" name="updEmail"
                    class="w-full bg-[#213448]/50 border border-[#547792]/50 rounded-xl px-4 py-3 text-[#EAE0CF] focus:border-[#EAE0CF] focus:outline-none transition-all text-sm">
                </div>
              </div>

              <div class="pt-6 border-t border-[#547792]/20">
                <h4 class="text-[10px] uppercase tracking-widest text-[#94B4C1] font-bold mb-4">Security Update</h4>
                <div class="grid md:grid-cols-2 gap-6">
                  <div>
                    <label class="text-[11px] text-[#94B4C1] uppercase tracking-wider font-bold block mb-2">New Password (Optional)</label>
                    <input type="password" [(ngModel)]="updPassword" name="updPassword" placeholder="••••••••"
                      class="w-full bg-[#213448]/50 border border-[#547792]/50 rounded-xl px-4 py-3 text-[#EAE0CF] focus:border-[#EAE0CF] focus:outline-none transition-all text-sm">
                  </div>
                  <div>
                    <label class="text-[11px] text-[#94B4C1] uppercase tracking-wider font-bold block mb-2 text-emerald-400/80">Current Password (Required)</label>
                    <input type="password" [(ngModel)]="currentPass" name="currentPass" required placeholder="To authorize changes..."
                      class="w-full bg-[#213448]/50 border border-[#547792]/80 rounded-xl px-4 py-3 text-[#EAE0CF] focus:border-emerald-400 focus:outline-none transition-all text-sm">
                  </div>
                </div>
              </div>

              <div class="flex justify-end pt-4">
                <button type="submit" [disabled]="isSubmitting || !currentPass"
                  class="bg-[#547792] hover:bg-[#94B4C1] hover:text-[#213448] text-[#EAE0CF] font-black uppercase tracking-widest px-8 py-3.5 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-[#547792]/20 text-xs">
                  Save Changes
                </button>
              </div>
            </form>
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
export class ProfileComponent implements OnInit {
  user: any = null;
  updUsername = '';
  updEmail = '';
  updPassword = '';
  currentPass = '';
  
  successMsg = '';
  errorMsg = '';
  isSubmitting = false;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getMe().subscribe({
      next: (r: any) => {
        this.user = r;
        this.updUsername = r.username;
        this.updEmail = r.email;
      },
      error: () => { this.errorMsg = 'Failed to load profile data.'; }
    });
  }

  updateProfile() {
    this.errorMsg = '';
    this.successMsg = '';
    
    if (!this.currentPass) {
      this.errorMsg = 'Current password is required to save changes.';
      return;
    }

    this.isSubmitting = true;
    const payload: any = {
      username: this.updUsername,
      email: this.updEmail,
      current_password: this.currentPass
    };
    
    if (this.updPassword) {
      payload.password = this.updPassword;
    }

    this.api.updateMe(payload).subscribe({
      next: (r: any) => {
        this.successMsg = 'Profile updated successfully!';
        this.user = r.user;
        this.currentPass = '';
        this.updPassword = '';
        this.isSubmitting = false;
        setTimeout(() => this.successMsg = '', 5000);
      },
      error: (err: any) => {
        this.errorMsg = err.error?.error || 'Failed to update profile.';
        this.isSubmitting = false;
      }
    });
  }
}
