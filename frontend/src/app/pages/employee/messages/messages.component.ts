import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
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
export class MessagesComponent implements OnInit, OnDestroy {
  private pollingInterval: any;
  user: any = null;
  teamMembers: any[] = [];
  selectedMember: any = null;
  messages: any[] = [];
  newMessage = '';
  searchQuery = '';

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef,
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

    if (isPlatformBrowser(this.platformId)) {
      this.pollingInterval = setInterval(() => {
        if (this.selectedMember) {
          this.loadConversation(this.selectedMember.id, true);
        }
      }, 3000);
    }
  }

  ngOnDestroy() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
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
    this.messages = [];
    this.loadConversation(member.id);
  }

  loadConversation(memberId: string, isSilent = false) {
    this.api.getConversation(memberId).subscribe({
      next: (res: any) => {
        const mapped = res.map((m: any) => ({
          id: m.id,
          text: m.text,
          time: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          incoming: m.sender_id !== this.user?.id,
          is_read: m.is_read
        }));
        
        // Only update if data changed to avoid flickering
        if (JSON.stringify(mapped) !== JSON.stringify(this.messages)) {
          this.messages = mapped;
          this.cdr.detectChanges();
          if (!isSilent) this.scrollToBottom();
        }
      },
      error: () => {
        if (!isSilent) console.error('Failed to load conversation');
      }
    });
  }

  sendMessage() {
    if (!this.newMessage.trim() || !this.selectedMember) return;
    
    const text = this.newMessage;
    this.newMessage = '';

    this.api.sendMessage(this.selectedMember.id, text).subscribe({
      next: () => {
        this.loadConversation(this.selectedMember.id, true);
      },
      error: () => {
        console.error('Failed to send message');
      }
    });
  }

  scrollToBottom() {
    setTimeout(() => {
      const feed = document.querySelector('.chat-feed');
      if (feed) feed.scrollTop = feed.scrollHeight;
    }, 100);
  }

  getInitial(member: any): string {
    return (member?.first_name || 'U').charAt(0).toUpperCase();
  }
}
