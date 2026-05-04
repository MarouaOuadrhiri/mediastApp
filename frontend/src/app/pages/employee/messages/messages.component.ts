import { Component, OnInit, Inject, PLATFORM_ID, ViewChild, ElementRef, AfterViewChecked, OnDestroy } from '@angular/core';
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
export class MessagesComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('chatFeed') private chatFeed!: ElementRef;
  user: any = null;
  teamMembers: any[] = [];
  selectedMember: any = null;
  messages: any[] = [];
  newMessage = '';
  searchQuery = '';
  isSending = false;
  private pollInterval: any;

  constructor(
    private api: ApiService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.api.getMe().subscribe({
        next: (r: any) => { 
          this.user = r; 
          this.loadTeamMembers();
        },
        error: () => {
          this.loadTeamMembers();
        }
      });
    }
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      if (this.chatFeed) {
        this.chatFeed.nativeElement.scrollTop = this.chatFeed.nativeElement.scrollHeight;
      }
    } catch(err) { }
  }

  ngOnDestroy() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }

  loadTeamMembers() {
    this.api.getMyTeam().subscribe({
      next: (res: any) => {
        const members = Array.isArray(res) ? res : (res.results || []);
        this.processMembers(members);
      },
      error: (err: any) => {
        console.warn('Failed to load specific team members, falling back to full employee list', err);
        // Fallback to all employees if team-specific endpoint fails
        this.api.getEmployees().subscribe({
          next: (res: any) => {
            const members = Array.isArray(res) ? res : (res.results || []);
            this.processMembers(members);
          },
          error: (e: any) => {
            console.error('Critical failure: Could not load any employees', e);
          }
        });
      }
    });
  }

  processMembers(members: any[]) {
    const currentId = this.getId(this.user);
    const others = members.filter((m: any) => this.getId(m) !== currentId);
    if (others.length > 0) {
      this.teamMembers = others.map(m => ({ ...m, id: this.getId(m) }));
    }

    // Auto-select first real member if none selected
    if (this.teamMembers.length > 0 && !this.selectedMember) {
      this.selectMember(this.teamMembers[0]);
    }
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
    this.loadMessages(member.id);
    
    // Start polling for new messages every 1 second
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => {
      if (this.selectedMember && this.selectedMember.id !== 'system_support') {
        this.loadMessages(this.selectedMember.id, true);
      }
    }, 1000);
  }

  private getId(obj: any): string {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    return obj.id || obj._id || (obj.$oid ? obj.$oid : '');
  }

  loadMessages(memberId: string, isSilent = false) {
    if (!memberId) return;

    if (!isSilent) console.log(`Fetching all messages for conversation with: ${memberId}`);
    this.api.getMessages(memberId).subscribe({
      next: (res: any) => {
        const allMessages = Array.isArray(res) ? res : (res.results || []);
        if (!isSilent) console.log(`Received ${allMessages.length} raw messages from API`);
        
        const currentId = this.getId(this.user);
        const targetId = memberId;

        const filtered = allMessages.filter((m: any) => {
          const mSender = this.getId(m.sender);
          const mReceiver = this.getId(m.receiver);
          return (mSender === currentId && mReceiver === targetId) ||
                 (mSender === targetId && mReceiver === currentId);
        });

        // Sort by timestamp ascending
        filtered.sort((a: any, b: any) => {
          return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        });

        this.messages = filtered.map((m: any) => this.mapMessage(m));
        if (!isSilent) console.log(`Filtered and sorted ${this.messages.length} messages`);
      },
      error: (err) => {
        if (!isSilent) console.error('Failed to load real messages', err);
      }
    });
  }

  private mapMessage(m: any) {
    const currentUserId = this.getId(this.user);
    const mSender = this.getId(m.sender);
    const isIncoming = mSender !== currentUserId;
    
    return {
      id: this.getId(m),
      text: m.text,
      time: m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
      incoming: isIncoming,
      fromId: mSender
    };
  }

  sendMessage() {
    if (!this.newMessage.trim() || !this.selectedMember || this.isSending) return;
    
    this.isSending = true;
    const currentText = this.newMessage;
    this.newMessage = ''; // Clear immediately for better feel

    const payload = {
      receiver: this.selectedMember.id,
      text: currentText
    };

    this.api.sendMessage(payload).subscribe({
      next: (res: any) => {
        this.messages.push(this.mapMessage(res));
        this.isSending = false;
      },
      error: (err) => {
        this.newMessage = currentText; // Restore on error
        this.isSending = false;
        console.error('Failed to send real message', err);
      }
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      // For now, we'll send it as a special text message
      // In a real app, you'd upload it to S3/Cloudinary and send the URL
      this.newMessage = `📎 Shared a file: ${file.name}`;
      this.sendMessage();
    }
  }

  getInitial(member: any): string {
    return (member?.first_name || 'U').charAt(0).toUpperCase();
  }
}
