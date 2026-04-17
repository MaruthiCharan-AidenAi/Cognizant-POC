import {
  Component, Input, Output, EventEmitter,
  OnInit, AfterViewChecked, ViewChild, ElementRef
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Message, User, Suggestion, ErrorState } from '../../models/chat.models';
import { SseService } from '../../services/sse.service';
import { AuthService } from '../../services/auth.service';
import { apiUrl, generateSessionId } from '../../services/api.util';
import { MessageBubbleComponent } from '../message-bubble/message-bubble.component';
import { TypingIndicatorComponent } from '../typing-indicator/typing-indicator.component';
import { ErrorBannerComponent } from '../error-banner/error-banner.component';

const CARD_GRADIENTS = [
  { from: '#6366f1', to: '#8b5cf6' },
  { from: '#0891b2', to: '#06b6d4' },
  { from: '#059669', to: '#10b981' },
  { from: '#d97706', to: '#f59e0b' },
];

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [FormsModule, MessageBubbleComponent, TypingIndicatorComponent, ErrorBannerComponent],
  templateUrl: './chat-window.component.html',
  styleUrl:    './chat-window.component.css',
})
export class ChatWindowComponent implements OnInit, AfterViewChecked {
  @Input()  token: string = '';
  @Input()  user: User | null = null;
  @Output() onSignOut = new EventEmitter<void>();

  @ViewChild('messagesEnd') messagesEnd!: ElementRef;
  @ViewChild('inputEl')     inputEl!: ElementRef<HTMLTextAreaElement>;

  messages: Message[]      = [];
  inputText                = '';
  error: ErrorState | null = null;
  waitingForFirst          = false;
  currentId                = '';
  focused                  = false;
  sessionId                = generateSessionId();
  suggestionsLoading       = false;
  suggestions: Suggestion[] = [];   // empty until API responds

  get firstName()  { return this.user?.name?.split(' ')[0] || 'there'; }
  get userInitial(){ return (this.user?.name || this.user?.email || 'U').slice(0,1).toUpperCase(); }
  get pillName()   {
    if (this.user?.name) return this.user.name.split(' ')[0] || this.user.email || 'User';
    return this.user?.email || 'User';
  }

  private shouldScroll = false;

  constructor(public sse: SseService, private auth: AuthService) {}

  ngOnInit(): void {
    if (!this.token) this.token = this.auth.token() || '';
    if (!this.user)  this.user  = this.auth.user();
    this.loadSuggestions();
    setTimeout(() => this.inputEl?.nativeElement.focus(), 100);
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.messagesEnd?.nativeElement.scrollIntoView({ behavior: 'smooth' });
      this.shouldScroll = false;
    }
  }

  /* ── GET /suggestions ── */
  private async loadSuggestions(): Promise<void> {
    const token = this.token || this.auth.token();
    if (!token) return;

    this.suggestionsLoading = true;
    try {
      const res = await fetch(apiUrl('/suggestions'), {
        method:      'GET',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: {
        role?:        string;
        region?:      string;
        suggestions?: string[];
      } = await res.json();

      if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        this.suggestions = data.suggestions.slice(0, 4).map((text, i) => ({
          text,
          from: CARD_GRADIENTS[i % CARD_GRADIENTS.length].from,
          to:   CARD_GRADIENTS[i % CARD_GRADIENTS.length].to,
        }));
      }

      // Update role/region if returned
      if (data.role || data.region) {
        const current = this.auth.user();
        if (current) {
          const updated: User = {
            ...current,
            role:   data.role   ?? current.role,
            region: data.region ?? current.region,
          };
          this.auth.user.set(updated);
          this.user = updated;
          sessionStorage.setItem('auth_user', JSON.stringify(updated));
        }
      }

    } catch (e) {
      console.warn('GET /suggestions failed:', e);
      this.suggestions = [];   // empty on error — no defaults
    } finally {
      this.suggestionsLoading = false;
    }
  }

  useSuggestion(t: string): void {
    this.inputText = t;
    this.inputEl?.nativeElement.focus();
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
  }

  autoResize(e: Event): void {
    const el = e.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  async send(): Promise<void> {
    const trimmed = this.inputText.trim();
    if (!trimmed || this.sse.isStreaming()) return;
    this.error = null;

    const userMsg: Message = {
      id:        `user-${Date.now()}`,
      role:      'user',
      content:   trimmed,
      timestamp: new Date(),
    };
    this.messages     = [...this.messages, userMsg];
    this.inputText    = '';
    this.shouldScroll = true;

    const aid = `assistant-${Date.now()}`;
    this.currentId = aid;
    this.messages  = [...this.messages, {
      id: aid, role: 'assistant', content: '',
      timestamp: new Date(), assumptions: [], confidence: undefined,
    }];
    this.waitingForFirst = true;

    await this.sse.startStream({
      url:   apiUrl('/chat'),
      body:  { message: trimmed, session_id: this.sessionId },
      token: this.token,

      onChunk: (data) => {
        if (data.type === 'token') {
          this.waitingForFirst = false;
          this.messages = this.messages.map(m =>
            m.id === aid ? { ...m, content: m.content + data.content } : m
          );
          this.shouldScroll = true;
        } else if (data.type === 'confidence') {
          this.messages = this.messages.map(m =>
            m.id === aid ? { ...m, confidence: { score: data.score, level: data.level } } : m
          );
        } else if (data.type === 'assumption') {
          this.messages = this.messages.map(m =>
            m.id === aid ? { ...m, assumptions: [...(m.assumptions || []), data.text] } : m
          );
        } else if (data.type === 'chart' && data.chart) {
          const block = '\n```chart\n' + JSON.stringify(data.chart) + '\n```\n';
          this.messages = this.messages.map(m =>
            m.id === aid ? { ...m, content: m.content + block } : m
          );
        }
      },

      onError: (err) => {
        this.waitingForFirst = false;
        this.error = err;
        this.messages = this.messages.filter(m => m.id !== aid);
      },

      onDone: () => {
        this.waitingForFirst = false;
        this.shouldScroll    = true;
        this.messages = this.messages.map(m => m.id === aid ? { ...m } : m);
      },
    });
  }
}