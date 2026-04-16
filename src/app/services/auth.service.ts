import { Injectable, signal, NgZone } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { User } from '../models/chat.models';
import { environment } from '../../environments/environment';

declare const google: any;

@Injectable({ providedIn: 'root' })
export class AuthService {
  token            = signal<string | null>(null);
  user             = signal<User | null>(null);
  isAuthenticated  = signal(false);
  isLoading        = signal(true);
  isVerifyingLogin = signal(false);
  loginError       = signal<string | null>(null);

  private googleInitialized = false;

  constructor(
    private http:   HttpClient,
    private zone:   NgZone,
    private router: Router,
  ) {}

  init(): Promise<void> {
    return new Promise(resolve => {
      const savedToken = sessionStorage.getItem('auth_token');
      const savedUser  = sessionStorage.getItem('auth_user');

      if (savedToken && savedUser) {
        // ✅ Restore state immediately from sessionStorage — no API call
        try {
          const userData: User = JSON.parse(savedUser);
          this.token.set(savedToken);
          this.user.set(userData);
          this.isAuthenticated.set(true);
        } catch {
          this.clearAllStorage();
        }
        this.isLoading.set(false);
        resolve();

        // Verify token silently in background (doesn't block UI)
        this.verifyTokenSilently(savedToken);
      } else {
        this.isLoading.set(false);
        resolve();
      }
    });
  }

  renderSignInButton(el: HTMLElement): void {
    if (!this.googleInitialized) {
      google.accounts.id.initialize({
        client_id: environment.googleClientId,
        callback: (resp: any) => this.zone.run(() => this.handleCredential(resp.credential)),
      });
      this.googleInitialized = true;
    }
    google.accounts.id.renderButton(el, {
      theme: 'outline', size: 'large', shape: 'pill', width: 280,
    });
  }

  private async handleCredential(credential: string): Promise<void> {
    this.isVerifyingLogin.set(true);
    this.loginError.set(null);
    try {
      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${credential}`,
      });
      const res: any = await firstValueFrom(
        this.http.post(`${environment.apiUrl}/auth/login`, {}, { headers, withCredentials: true })
      );
      const savedToken = res?.token ?? res?.access_token ?? credential;
      const userData: User = res?.user ?? {
        email:   res?.email   ?? '',
        name:    res?.name    ?? res?.full_name ?? '',
        picture: res?.picture ?? res?.avatar   ?? '',
        role:    res?.role    ?? '',
        region:  res?.region  ?? '',
      };

      // ✅ Save both token AND user to sessionStorage
      sessionStorage.setItem('auth_token', savedToken);
      sessionStorage.setItem('auth_user',  JSON.stringify(userData));

      this.token.set(savedToken);
      this.user.set(userData);
      this.isAuthenticated.set(true);
      this.router.navigate(['/chat']);

    } catch (e: any) {
      this.loginError.set(e?.error?.detail || 'Sign-in failed. Please try again.');
    } finally {
      this.isVerifyingLogin.set(false);
    }
  }

  // ✅ Silent background verify — only logs out if token is truly invalid
  private async verifyTokenSilently(t: string): Promise<void> {
    try {
      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        Authorization: `Bearer ${t}`,
      });
      const res: any = await firstValueFrom(
        this.http.post(`${environment.apiUrl}/auth/login`, {}, { headers, withCredentials: true })
      );
      // Update user data if refreshed from backend
      const savedToken = res?.token ?? res?.access_token ?? t;
      const userData: User = res?.user ?? {
        email:   res?.email   ?? '',
        name:    res?.name    ?? res?.full_name ?? '',
        picture: res?.picture ?? res?.avatar   ?? '',
        role:    res?.role    ?? '',
        region:  res?.region  ?? '',
      };
      sessionStorage.setItem('auth_token', savedToken);
      sessionStorage.setItem('auth_user',  JSON.stringify(userData));
      this.token.set(savedToken);
      this.user.set(userData);
    } catch {
      // Token expired — silently log out
      this.clearAllStorage();
      this.token.set(null);
      this.user.set(null);
      this.isAuthenticated.set(false);
      this.router.navigate(['/']);
    }
  }

  signOut(): void {
    this.clearAllStorage();
    this.token.set(null);
    this.user.set(null);
    this.isAuthenticated.set(false);
    this.googleInitialized = false;
    try { google.accounts.id.disableAutoSelect(); } catch {}
    this.router.navigate(['/']);
  }

  private clearAllStorage(): void {
    sessionStorage.clear();
    localStorage.clear();
    document.cookie.split(';').forEach(cookie => {
      const name = cookie.split('=')[0].trim();
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
    });
  }
}