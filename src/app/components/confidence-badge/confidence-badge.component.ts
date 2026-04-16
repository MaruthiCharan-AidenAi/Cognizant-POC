import { Component, Input, OnChanges } from '@angular/core';

@Component({
  selector: 'app-confidence-badge',
  standalone: true,
  template: `
    <div class="cb-wrap">
      <span class="cb-pill"
            [style.background]="cfg.bg"
            [style.border-color]="cfg.border"
            [style.color]="cfg.text">
        <span>{{ cfg.icon }}</span>
        <span>{{ level }}</span>
        <span class="cb-score">{{ score }}</span>
      </span>
      <div class="cb-bar-bg">
        <div class="cb-bar" [style.width.%]="pct" [style.background]="cfg.bar"></div>
      </div>
    </div>
  `,
  styles: [`
    .cb-wrap   { display:inline-flex; flex-direction:column; gap:5px; min-width:120px; }
    .cb-pill   { display:inline-flex; align-items:center; gap:5px; padding:3px 10px;
                 border-radius:9999px; font-size:11px; font-weight:600; border:1px solid; }
    .cb-score  { font-family:monospace; opacity:.65; }
    .cb-bar-bg { height:3px; width:100%; border-radius:9999px; background:rgba(0,0,0,.08); overflow:hidden; }
    .cb-bar    { height:100%; border-radius:9999px; transition:width .6s ease; }
  `]
})
export class ConfidenceBadgeComponent implements OnChanges {
  @Input() score: number = 0;
  @Input() level: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
  cfg: any = {};
  pct = 0;
  private configs: Record<string, any> = {
    HIGH:   { bg:'#f0fdf4', border:'#86efac', text:'#15803d', bar:'linear-gradient(90deg,#22c55e,#16a34a)', icon:'✓' },
    MEDIUM: { bg:'#fffbeb', border:'#fcd34d', text:'#92400e', bar:'linear-gradient(90deg,#f59e0b,#d97706)', icon:'◐' },
    LOW:    { bg:'#fff1f2', border:'#fda4af', text:'#be123c', bar:'linear-gradient(90deg,#f43f5e,#e11d48)', icon:'✕' },
  };
  ngOnChanges() {
    this.cfg = this.configs[this.level] || this.configs['MEDIUM'];
    this.pct = Math.min(100, Math.max(0, Number(this.score) || 0));
  }
}