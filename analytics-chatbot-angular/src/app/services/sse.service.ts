import { Injectable, signal } from '@angular/core';

export interface StreamOptions {
  url: string;
  body: Record<string, any>;
  token: string;
  onChunk: (data: any) => void;
  onError: (err: any) => void;
  onDone: () => void;
}

@Injectable({ providedIn: 'root' })
export class SseService {
  isStreaming = signal(false);
  private abortCtrl: AbortController | null = null;

  async startStream(opts: StreamOptions): Promise<void> {
    this.abortCtrl = new AbortController();
    this.isStreaming.set(true);
    try {
      const res = await fetch(opts.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${opts.token}`,
        },
        body: JSON.stringify(opts.body),
        signal: this.abortCtrl.signal,
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        opts.onError({ status: res.status, ...err });
        return;
      }

      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          try {
            const parsed = JSON.parse(raw);

            // ✅ Backend sends {"type":"done"} — treat as stream end
            if (parsed.type === 'done') {
              opts.onDone();
              return;
            }

            opts.onChunk(parsed);
          } catch {
            // ignore malformed lines
          }
        }
      }

      opts.onDone();
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        opts.onError({ status: 0, error: 'network_error' });
      } else {
        opts.onDone();
      }
    } finally {
      this.isStreaming.set(false);
    }
  }

  stopStream(): void { this.abortCtrl?.abort(); }
}