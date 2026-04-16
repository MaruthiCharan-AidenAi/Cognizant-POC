import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from './services/auth.service';
import { LoginComponent } from './components/login/login.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { ChatWindowComponent } from './components/chat-window/chat-window.component';
import { LoadingComponent } from './components/loading/loading.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, LoginComponent, SidebarComponent,ChatWindowComponent,LoadingComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class AppComponent implements OnInit {
  sidebarCollapsed = false;

  constructor(public auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.auth.init().then(() => {
      if (this.auth.isAuthenticated()) {
        // Already authenticated (token in session) → go to /chat
        this.router.navigate(['/chat']);
      } else {
        // Not authenticated → stay on /
        this.router.navigate(['/']);
      }
    });
  }
}