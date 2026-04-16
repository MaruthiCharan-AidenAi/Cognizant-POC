import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { NgIf, NgFor } from '@angular/common';
import { marked } from 'marked';
import { Message, User } from '../../models/chat.models';
import { ConfidenceBadgeComponent } from '../confidence-badge/confidence-badge.component';
import {
  ChartRendererComponent, ChartSpec, normalizeChartSpec,
} from '../chart-renderer/chart-renderer.component';

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true });
}

function isChartComplete(content: string): boolean {
  const open = content.indexOf('```chart');
  if (open === -1) return true;
  return content.indexOf('```', open + 8) !== -1;
}

function extractChartAndMarkdown(content: string): { spec: ChartSpec|null; markdown: string } {
  const src = content || '';
  let spec: ChartSpec | null = null;
  let md = src;

  const chartFence = src.match(/```chart\s*([\s\S]*?)```/i);
  if (chartFence?.[1]) {
    try { spec = normalizeChartSpec(JSON.parse(chartFence[1].trim())); } catch {}
    md = md.replace(/```chart\s*[\s\S]*?```/gi, '');
  }

  if (!spec) {
    const re = /```(?:json)?\s*([\s\S]*?)```/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      try {
        const c = normalizeChartSpec(JSON.parse(m[1].trim()));
        if (c) { spec = c; md = md.replace(m[0], ''); break; }
      } catch {}
    }
  }

  return { spec, markdown: md.trim() };
}

@Component({
  selector: 'app-message-bubble',
  standalone: true,
  imports: [NgIf, NgFor, ConfidenceBadgeComponent, ChartRendererComponent],
  templateUrl: './message-bubble.component.html',
  styleUrl:    './message-bubble.component.css',
})
export class MessageBubbleComponent implements OnChanges {
  @Input() message!: Message;
  @Input() user: User | null = null;

  isUser      = false;
  html: SafeHtml = '';
  chartSpec: ChartSpec | null = null;
  userInitial = 'U';
  timeStr     = '';

  constructor(private san: DomSanitizer) {}

  ngOnChanges(c: SimpleChanges): void {
    this.isUser      = this.message.role === 'user';
    this.userInitial = (this.user?.name || this.user?.email || 'U').slice(0,1).toUpperCase();
    this.timeStr     = formatTime(new Date(this.message.timestamp));

    if (!this.isUser && this.message.content) {
      if (isChartComplete(this.message.content)) {
        const { spec, markdown } = extractChartAndMarkdown(this.message.content);
        // ✅ Always assign new object so ChartRenderer's ngOnChanges fires
        this.chartSpec = spec ? { ...spec } : null;
        this.html = this.san.bypassSecurityTrustHtml(marked.parse(markdown) as string);
      } else {
        // Still streaming chart JSON — show text only
        this.chartSpec = null;
        const stripped = this.message.content.replace(/```chart[\s\S]*$/i, '').trim();
        this.html = this.san.bypassSecurityTrustHtml(marked.parse(stripped) as string);
      }
    } else {
      this.chartSpec = null;
      this.html = '';
    }
  }

  copy(): void {
    navigator.clipboard.writeText(this.message.content).catch(() => {});
  }
}