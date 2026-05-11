import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';

@Component({
  selector: 'app-employee-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit {
  user: any = null;
  firstName = '';
  lastName = '';
  profilePhoto = '';

  // Active nav section
  activeSection = 'notifications';



  // Localization
  interfaceLanguage = 'English (United States)';
  timeZone = '(GMT-08:00) Pacific Time';

  languages = [
    'English (United States)',
    'Français (France)',
    'Español (España)',
    'Deutsch (Deutschland)',
    'العربية'
  ];

  timeZones = [
    '(GMT-08:00) Pacific Time',
    '(GMT-05:00) Eastern Time',
    '(GMT+00:00) UTC',
    '(GMT+01:00) Central European Time',
    '(GMT+03:00) Arabia Standard Time'
  ];

  // Account Preferences
  publicProfile = false;
  activityTracking = true;
  twoFactorEnabled = false; // Note: Keeping for potential future use or if backend still expects it, but removing UI references. Actually, user asked to remove the row, so logic might still be needed if other components use it, but here it's dead. I'll just remove the UI-only parts.


  saved = false;

  constructor(
    private api: ApiService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    this.api.getMe().subscribe({
      next: (r: any) => {
        this.user = r;
        this.firstName = r.first_name || '';
        this.lastName = r.last_name || '';
        this.profilePhoto = r.profile_photo || '';
        if (r.preferences) {
          this.publicProfile = r.preferences.public_profile ?? false;
          this.activityTracking = r.preferences.activity_tracking ?? true;
        }
      },
      error: () => {}
    });
  }



  scrollTo(section: string) {
    this.activeSection = section;
    const el = document.getElementById(section);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }



  saveSettings() {
    const payload = {
      preferences: {
        public_profile: this.publicProfile,
        activity_tracking: this.activityTracking,
        interface_language: this.interfaceLanguage,
        time_zone: this.timeZone

      }
    };
    this.api.updatePreferences(payload).subscribe({
      next: () => {
        this.saved = true;
        setTimeout(() => this.saved = false, 2500);
      }
    });
  }
}
