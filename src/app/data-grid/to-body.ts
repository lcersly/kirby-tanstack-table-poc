import { Directive, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';

/** Flytter elementet til document.body, så det kan ligge over hele siden (fx en scrim over header og menu). */
@Directive({ selector: '[appToBody]' })
export class ToBodyDirective implements OnInit, OnDestroy {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  ngOnInit() {
    document.body.appendChild(this.el);
  }

  ngOnDestroy() {
    this.el.remove();
  }
}
