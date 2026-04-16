import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './services/auth.service';

// Guard: redirect to '/' if not authenticated
const authGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  return router.createUrlTree(['/']);
};

// Guard: redirect to '/chat' if already authenticated (for login page)
const guestGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return true;
  return router.createUrlTree(['/chat']);
};

export const routes: Routes = [
  {
    path: '',
    canActivate: [guestGuard],
    // Login is handled in app.html via @if — empty path just validates guard
    loadComponent: () =>
      import('./components/login/login.component')
        .then(m => m.LoginComponent),
  },
  {
    path: 'chat',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/chat-window/chat-window.component')
        .then(m => m.ChatWindowComponent),
  },
  { path: '**', redirectTo: '' },
];