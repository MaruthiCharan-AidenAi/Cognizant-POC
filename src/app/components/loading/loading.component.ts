import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-loading',
  standalone: true,
  templateUrl: './loading.component.html',
  styleUrl:    './loading.component.css',
})
export class LoadingComponent implements OnInit, OnDestroy {
  @Input() isVerifying = false;

  stepDone = false;
  progress = 15;

  private t1: any;
  private t2: any;
  private t3: any;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    if (!this.isVerifying) return;

    // 600ms → animate to 70%
    this.t1 = setTimeout(() => {
      this.progress = 70;
      this.cdr.detectChanges();

      // 600ms more → animate to 100% + checkmark
      this.t2 = setTimeout(() => {
        this.progress  = 100;
        this.stepDone  = true;
        this.cdr.detectChanges();
      }, 800);

    }, 600);
  }

  ngOnDestroy(): void {
    clearTimeout(this.t1);
    clearTimeout(this.t2);
    clearTimeout(this.t3);
  }
}