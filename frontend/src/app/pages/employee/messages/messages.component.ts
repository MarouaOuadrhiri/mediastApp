import { Component, OnInit, Inject, PLATFORM_ID, ViewChild, ElementRef, AfterViewChecked, OnDestroy } from '@angular/core';

const ATTACH = '__ATTACHMENT__:';
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
  isLoadingMessages = false;
  sharedMedia: string[] = [];
  showFilesModal = false;
  messageCountByUser: { [id: string]: number } = {};
  private shouldScroll = false;

  /** Raw messages kept for grouping & last-message-time computation */
  private allRawMessages: any[] = [];

  // Static team channels for the sidebar
  teamChannels = [
    { name: 'brand-strategy', members: 12, hasUnread: true },
    { name: 'design-review', members: 8, hasUnread: false },
  ];

  private pollInterval: any;
  private onlineStatusInterval: any;

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

      // Fix 1 — Poll online status every 30 seconds
      this.onlineStatusInterval = setInterval(() => {
        this.refreshOnlineStatuses();
      }, 30_000);
    }
  }

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  private scrollToBottom(): void {
    try {
      if (this.chatFeed) {
        this.chatFeed.nativeElement.scrollTop = this.chatFeed.nativeElement.scrollHeight;
      }
    } catch (err) {}
  }

  ngOnDestroy() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.onlineStatusInterval) clearInterval(this.onlineStatusInterval);
  }

  loadTeamMembers() {
    this.api.getMyTeam().subscribe({
      next: (res: any) => {
        const members = Array.isArray(res) ? res : (res.results || []);
        this.processMembers(members);
      },
      error: (err: any) => {
        console.warn('Failed to load specific team members, falling back to full employee list', err);
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
      this.teamMembers = others.map(m => ({
        ...m,
        id: this.getId(m),
        // Fix 1 — map online flag from API response fields
        isOnline: m.is_online === true || m.online === true || m.status === 'active'
      }));
    }

    if (this.teamMembers.length > 0 && !this.selectedMember) {
      this.selectMember(this.teamMembers[0]);
    }
  }

  /** Fix 1 — Re-fetch team list and update isOnline per member */
  private refreshOnlineStatuses() {
    const fetchFn = (res: any) => {
      const members = Array.isArray(res) ? res : (res.results || []);
      const currentId = this.getId(this.user);
      members
        .filter((m: any) => this.getId(m) !== currentId)
        .forEach((m: any) => {
          const id = this.getId(m);
          const existing = this.teamMembers.find(tm => tm.id === id);
          if (existing) {
            existing.isOnline = m.is_online === true || m.online === true || m.status === 'active';
          }
        });
    };

    this.api.getMyTeam().subscribe({
      next: fetchFn,
      error: () => this.api.getEmployees().subscribe({ next: fetchFn, error: () => {} })
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
    // Avoid duplicate load when clicking same member
    if (this.selectedMember?.id === member.id) return;

    this.selectedMember = member;
    this.sharedMedia = [];
    this.allRawMessages = [];
    this.messages = [];          // clear immediately so old msgs vanish
    this.isLoadingMessages = true;
    this.shouldScroll = true;
    this.loadMessages(member.id);

    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => {
      if (this.selectedMember && this.selectedMember.id !== 'system_support') {
        this.loadMessages(this.selectedMember.id, true);
      }
    }, 2000); // 2-second live poll
  }

  private getId(obj: any): string {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    return obj.id || obj._id || (obj.$oid ? obj.$oid : '');
  }

  loadMessages(memberId: string, isSilent = false) {
    if (!memberId) return;
    if (!isSilent) console.log(`Fetching messages for: ${memberId}`);

    this.api.getMessages(memberId).subscribe({
      next: (res: any) => {
        // Discard response if user already switched to someone else
        if (this.selectedMember?.id !== memberId) return;

        const allMessages = Array.isArray(res) ? res : (res.results || []);
        const currentId = this.getId(this.user);

        const filtered = allMessages.filter((m: any) => {
          const s = this.getId(m.sender), r = this.getId(m.receiver);
          return (s === currentId && r === memberId) || (s === memberId && r === currentId);
        });
        filtered.sort((a: any, b: any) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        const newMessages = filtered.map((m: any) => this.mapMessage(m));

        // Scroll to bottom only when new messages arrive
        if (newMessages.length > this.messages.length) {
          this.shouldScroll = true;
        }

        this.allRawMessages = filtered;
        this.messages = newMessages;
        this.isLoadingMessages = false;

        // Update sidebar count badge
        this.messageCountByUser[memberId] = newMessages.length;
      },
      error: (err) => {
        if (!isSilent) console.error('Failed to load messages', err);
        this.isLoadingMessages = false;
      }
    });
  }

  private mapMessage(m: any) {
    const currentUserId = this.getId(this.user);
    const mSender = this.getId(m.sender);
    const isIncoming = mSender !== currentUserId;

    let isFile = false, fileName = '', fileType = '', fileSize = 0, fileDataUrl = '', displayText = m.text || '';
    if (m.text && m.text.startsWith(ATTACH)) {
      try {
        const meta = JSON.parse(m.text.substring(ATTACH.length));
        isFile = true; fileName = meta.name || 'file'; fileType = meta.type || '';
        fileSize = meta.size || 0; fileDataUrl = meta.dataUrl || ''; displayText = '';
      } catch (e) {}
    }

    return {
      id: this.getId(m), text: displayText, timestamp: m.timestamp,
      time: m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now',
      incoming: isIncoming, fromId: mSender,
      isFile, fileName, fileType, fileSize, fileDataUrl
    };
  }

  // Fix 3 — Grouped messages by calendar day
  get groupedMessages(): { label: string; messages: any[] }[] {
    if (!this.messages.length) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const groups: { [key: string]: { label: string; date: Date; messages: any[] } } = {};

    for (const msg of this.messages) {
      const ts = msg.timestamp ? new Date(msg.timestamp) : new Date();
      const day = new Date(ts);
      day.setHours(0, 0, 0, 0);
      const key = day.toISOString();

      if (!groups[key]) {
        let label: string;
        if (day.getTime() === today.getTime()) {
          label = 'Today';
        } else if (day.getTime() === yesterday.getTime()) {
          label = 'Yesterday';
        } else {
          label = day.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        }
        groups[key] = { label, date: day, messages: [] };
      }
      groups[key].messages.push(msg);
    }

    return Object.values(groups).sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  // Fix 2 — Dynamic last-message time for the sidebar
  getLastMessageTime(member: any): string {
    if (!this.allRawMessages.length && this.selectedMember?.id !== member.id) return '—';

    // For selected member use cached raw messages; otherwise no data yet
    if (this.selectedMember?.id !== member.id) return '—';

    const sorted = [...this.allRawMessages].sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    if (!sorted.length) return '—';

    const last = new Date(sorted[0].timestamp);
    const now = new Date();
    const diffMs = now.getTime() - last.getTime();
    const diffM = Math.floor(diffMs / 60_000);
    const diffH = Math.floor(diffM / 60);
    const diffD = Math.floor(diffH / 24);

    if (diffM < 1) return 'now';
    if (diffM < 60) return `${diffM}m`;
    if (diffH < 24) return `${diffH}h`;
    return `${diffD}d`;
  }

  sendMessage() {
    if (!this.newMessage.trim() || !this.selectedMember || this.isSending) return;

    this.isSending = true;
    const currentText = this.newMessage;
    this.newMessage = '';

    const payload = {
      receiver: this.selectedMember.id,
      text: currentText
    };

    this.api.sendMessage(payload).subscribe({
      next: (res: any) => {
        const mapped = this.mapMessage(res);
        this.messages.push(mapped);
        this.allRawMessages.push(res);
        this.isSending = false;
      },
      error: (err) => {
        this.newMessage = currentText;
        this.isSending = false;
        console.error('Failed to send message', err);
      }
    });
  }

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('File too large. Max size is 5 MB.'); return; }
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const meta = { name: file.name, type: file.type, size: file.size, dataUrl: e.target.result };
      this.newMessage = `${ATTACH}${JSON.stringify(meta)}`;
      this.sendMessage();
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  downloadFile(msg: any) {
    if (!msg.fileDataUrl) return;
    const a = document.createElement('a');
    a.href = msg.fileDataUrl; a.download = msg.fileName || 'download';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  getFileCategory(type: string): string {
    if (!type) return 'file';
    if (type.startsWith('image/')) return 'image';
    if (type === 'application/pdf') return 'pdf';
    if (type.includes('word') || type.includes('document') || type === 'application/msword') return 'word';
    if (type.includes('presentation') || type.includes('powerpoint') || type === 'application/vnd.ms-powerpoint') return 'ppt';
    return 'file';
  }

  getFileSizeLabel(bytes: number): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  getFileTypeLabel(type: string): string {
    const map: any = { image: 'Image', pdf: 'PDF Document', word: 'Word Document', ppt: 'PowerPoint', file: 'File' };
    return map[this.getFileCategory(type)] || 'File';
  }

  /** All file messages in the current conversation (sent + received) */
  get sharedFiles(): any[] {
    return this.messages.filter(m => m.isFile);
  }

  openFilesModal()  { this.showFilesModal = true; }
  closeFilesModal() { this.showFilesModal = false; }

  getInitial(member: any): string {
    return (member?.first_name || 'U').charAt(0).toUpperCase();
  }

  getCurrentTime(): string {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}