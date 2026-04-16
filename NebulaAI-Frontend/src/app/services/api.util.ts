import { environment } from '../../environments/environment';

export function apiUrl(path: string): string {
  return `${environment.apiUrl}${path}`;
}

export function generateSessionId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true
  });
}