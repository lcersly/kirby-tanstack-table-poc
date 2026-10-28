import { Component, input } from '@angular/core';

/**
 * Pil i stil med SF Symbols arrow.up og arrow.down.
 * [OPEN POINT: Tegnet efter SF Symbols-udseendet. Udskift med de eksporterede symboler fra SF Symbols-appen, når de er godkendt til brug]
 */
@Component({
  selector: 'app-sf-arrow',
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      [style.transform]="direction() === 'up' ? 'rotate(180deg)' : null"
    >
      <path d="M12 4v16M5.5 13.5 12 20l6.5-6.5" />
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
export class SfArrowComponent {
  readonly direction = input<'up' | 'down'>('down');
  readonly size = input(24);
}
