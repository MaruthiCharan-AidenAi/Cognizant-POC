import { Component, Input, Output, EventEmitter } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgIf } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NgIf, LucideAngularModule],
  templateUrl: './sidebar.component.html',
  styleUrl:    './sidebar.component.css',
})
export class SidebarComponent {
  @Input()  isCollapsed = false;
  @Output() toggleSidebar = new EventEmitter<void>();

  constructor(public auth: AuthService) {}

  toggle(): void {
    this.toggleSidebar.emit();
  }

  logout(): void {
    // ✅ Clears localStorage + sessionStorage + cookies → navigates to '/'
    this.auth.signOut();
  }
}