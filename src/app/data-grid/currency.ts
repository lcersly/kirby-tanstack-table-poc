import { Component, Input } from '@angular/core';
import { FlagAvatarComponent, FlagAvatarSize } from './flag-avatar';

/** Valutakode med landeflag (SVG i en cirkulær avatar) foran. */
@Component({
  selector: 'app-currency',
  imports: [FlagAvatarComponent],
  template: `@if (showFlag) {
      <app-flag-avatar [code]="code" [size]="flagSize"></app-flag-avatar>
    }{{ code }}`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: var(--kirby-spacing-xxs);
      white-space: nowrap;
    }
  `,
})
export class CurrencyComponent {
  @Input({ required: true }) code!: string;
  @Input() showFlag = true;
  @Input() flagSize: FlagAvatarSize = 'xs';
}
