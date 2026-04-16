import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements AfterViewInit {
  @ViewChild('signInContainer') signInContainer!: ElementRef;

  constructor(public auth: AuthService) {}

  ngAfterViewInit() {
  this.waitForGoogle().then(() => {
    this.auth.renderSignInButton(this.signInContainer.nativeElement);
  });
}

waitForGoogle(): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      if ((window as any).google?.accounts) {
        resolve();
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}
}