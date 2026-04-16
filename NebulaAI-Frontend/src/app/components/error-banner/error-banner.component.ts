import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { ErrorState } from '../../models/chat.models';

@Component({
  selector: 'app-error-banner',
  standalone: true,
  template: `
    @if (cfg) {
      <div class="eb" role="alert"
           [style.background]="cfg.bg"
           [style.border-color]="cfg.border"
           [style.color]="cfg.text">
        <span class="eb-icon">{{ cfg.icon }}</span>
        <div class="eb-body">
          <p class="eb-title">{{ cfg.title }}</p>
          <p class="eb-msg">{{ cfg.message }}</p>
        </div>
        <button class="eb-close" (click)="dismiss.emit()">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24"
               stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    }
  `,
  styles: [`
    .eb       { display:flex; align-items:flex-start; gap:10px; padding:10px 16px;
                margin:0 0 8px; border-radius:12px; border:1px solid;
                animation:slideUp .3s ease; }
    .eb-icon  { font-size:16px; flex-shrink:0; margin-top:1px; }
    .eb-body  { flex:1; min-width:0; }
    .eb-title { font-weight:600; font-size:13px; margin:0; }
    .eb-msg   { font-size:12px; opacity:.8; margin:2px 0 0; }
    .eb-close { background:none; border:none; cursor:pointer; opacity:.6;
                padding:2px; border-radius:6px; display:flex; }
    .eb-close:hover { opacity:1; background:rgba(0,0,0,.08); }
    @keyframes slideUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  `]
})
export class ErrorBannerComponent implements OnChanges {
  @Input() error: ErrorState | null = null;
  @Output() dismiss = new EventEmitter<void>();
  cfg: any = null;

  private cfgs: Record<string, any> = {
    rate_limit:          { icon:'⏱',  title:'Too Many Requests',               bg:'#fffbeb', border:'#fcd34d', text:'#92400e' },
    auth_error:          { icon:'🔒', title:'Authentication Error',             bg:'#fff1f2', border:'#fda4af', text:'#be123c' },
    network_error:       { icon:'🌐', title:'Connection Error',                 bg:'#fff1f2', border:'#fda4af', text:'#be123c' },
    service_unavailable: { icon:'⚙️', title:'Service Temporarily Unavailable',  bg:'#fffbeb', border:'#fcd34d', text:'#92400e' },
    unknown_error:       { icon:'⚠️', title:'Something Went Wrong',             bg:'#fff1f2', border:'#fda4af', text:'#be123c' },
  };

  ngOnChanges() {
    if (!this.error) { this.cfg = null; return; }
    let type = this.error.error || 'unknown_error';
    if      (this.error.status === 429)                                   type = 'rate_limit';
    else if (this.error.status === 401 || this.error.status === 403)      type = 'auth_error';
    else if (this.error.status === 503)                                   type = 'service_unavailable';
    else if (this.error.status === 0)                                     type = 'network_error';
    const base = this.cfgs[type] || this.cfgs['unknown_error'];
    this.cfg = { ...base, message: this.error.detail || this.msg(type) };
  }

  private msg(t: string): string {
    const m: Record<string, string> = {
      rate_limit:          `Please wait ${this.error?.retry_after || 60}s before trying again.`,
      auth_error:          'Your session has expired. Please sign in again.',
      network_error:       'Unable to reach the server. Check your connection.',
      service_unavailable: 'Service is busy. Please try again shortly.',
      unknown_error:       'An unexpected error occurred. Please try again.',
    };
    return m[t] || m['unknown_error'];
  }
}