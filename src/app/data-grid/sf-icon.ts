import { Component, input } from '@angular/core';

export type SfIconName = 'filter' | 'pin' | 'fit' | 'fit-all' | 'arrow-up' | 'arrow-down';

const PATHS: Record<SfIconName, string> = {
  filter: 'M4 7h16M7 12h10M10 17h4',
  pin: 'M9 3.75h6l-.75 5.5 2.75 3H7l2.75-3L9 3.75ZM12 12.25v8',
  fit: 'M4 5v14M20 5v14M6.5 12h4M8.5 10l2 2-2 2M17.5 12h-4M15.5 10l-2 2 2 2',
  'fit-all': 'M4 5v14M12 5v14M20 5v14M5.5 12h3M7 10l2 2-2 2M13.5 12h3M15 10l2 2-2 2',
  'arrow-down': 'M12 4.5v15M6.5 14l5.5 5.5 5.5-5.5',
  'arrow-up': 'M12 19.5v-15M6.5 10 12 4.5l5.5 5.5',
};

/**
 * Ikoner tegnet i stil med SF Symbols (line.3.horizontal.decrease, pin, arrow.up/down m.fl.), som Kirby ikke har.
 * [OPEN POINT: Udskift med de eksporterede symboler fra SF Symbols-appen, når de er godkendt til brug]
 */
@Component({
  selector: 'app-sf-icon',
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path [attr.d]="path()" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
  `,
})
export class SfIconComponent {
  readonly name = input.required<SfIconName>();
  readonly size = input(24);
  protected path() {
    return PATHS[this.name()];
  }
}
