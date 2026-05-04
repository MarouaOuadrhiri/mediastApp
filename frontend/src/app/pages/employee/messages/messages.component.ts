import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/api.service';

@Component({
  selector: 'app-employee-messages',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.css']
})
export class MessagesComponent implements OnInit {
  user: any = null;
  teamMembers: any[] = [];
  selectedMember: any = null;
  messages: any[] = [];
  newMessage = '';
  searchQuery = '';

  constructor(
    private api: ApiService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    this.api.getMe().subscribe({
      next: (r: any) => { 
        this.user = r; 
        this.loadTeamMembers();
      },
      error: () => {
        this.loadTeamMembers(); // Try anyway
      }
    });
  }

  loadTeamMembers() {
    this.api.getMyTeam().subscribe({
      next: (res: any) => {
        const members = Array.isArray(res) ? res : (res.results || []);
        // Filter out current user from team list
        this.teamMembers = members.filter((m: any) => m.id !== this.user?.id);
        
        // Auto-select first member if we have team and none selected
        if (this.teamMembers.length > 0 && !this.selectedMember) {
          this.selectMember(this.teamMembers[0]);
        }
      },
      error: () => {
        console.error('Failed to load team members');
      }
    });
  }

  get filteredMembers() {
    if (!this.searchQuery) return this.teamMembers;
    const q = this.searchQuery.toLowerCase();
    return this.teamMembers.filter(m =>
      (m.first_name + ' ' + m.last_name).toLowerCase().includes(q)
    );
  }

  selectMember(member: any) {
    this.selectedMember = member;
    // Placeholder messages - would connect to real messaging API
    this.messages = [
      { from: member, text: 'Hey! How is the project going?', time: '10:30 AM', incoming: true },
      { from: this.user, text: 'Going great! Almost done with the design phase.', time: '10:32 AM', incoming: false },
      { from: member, text: 'Awesome, let me know if you need any help.', time: '10:33 AM', incoming: true }
    ];
  }

  sendMessage() {
    if (!this.newMessage.trim()) return;
    this.messages.push({
      from: this.user,
      text: this.newMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      incoming: false
    });
    this.newMessage = '';
  }

  getInitial(member: any): string {
    return (member?.first_name || 'U').charAt(0).toUpperCase();
  }
}
