import { Component, Input } from '@angular/core';

export type FlagAvatarSize = 'xs' | 'xxs';

/**
 * Cirkulær avatar med et landeflag som SVG.
 * [OPEN POINT: Kirbys mindste avatar (xs) er 32 px. xs (24 px) og xxs (16 px) her er et bud på to
 * mindre størrelser, indtil Kirby har dem.]
 */
@Component({
  selector: 'app-flag-avatar',
  template: `
    <svg viewBox="0 0 36 24" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      @switch (code) {
        @case ('DKK') {
          <rect width="36" height="24" fill="#C8102E" />
          <rect x="11" width="4" height="24" fill="#fff" />
          <rect y="10" width="36" height="4" fill="#fff" />
        }
        @case ('SEK') {
          <rect width="36" height="24" fill="#006AA7" />
          <rect x="11" width="4" height="24" fill="#FECC00" />
          <rect y="10" width="36" height="4" fill="#FECC00" />
        }
        @case ('NOK') {
          <rect width="36" height="24" fill="#BA0C2F" />
          <rect x="10" width="6" height="24" fill="#fff" />
          <rect y="9" width="36" height="6" fill="#fff" />
          <rect x="11.5" width="3" height="24" fill="#00205B" />
          <rect y="10.5" width="36" height="3" fill="#00205B" />
        }
        @case ('EUR') {
          <rect width="36" height="24" fill="#003399" />
          @for (star of stars; track $index) {
            <circle [attr.cx]="star[0]" [attr.cy]="star[1]" r="1.1" fill="#FFCC00" />
          }
        }
        @case ('USD') {
          <rect width="36" height="24" fill="#fff" />
          @for (stripe of stripes; track stripe) {
            <rect [attr.y]="stripe * 3.6923" width="36" height="1.8462" fill="#B22234" />
          }
          <rect width="16" height="12.9" fill="#3C3B6E" />
          @for (dot of dots; track $index) {
            <circle [attr.cx]="dot[0]" [attr.cy]="dot[1]" r="0.7" fill="#fff" />
          }
        }
        @case ('GBP') {
          <rect width="36" height="24" fill="#012169" />
          <path d="M0 0L36 24M36 0L0 24" stroke="#fff" stroke-width="4.8" />
          <path d="M0 0L36 24M36 0L0 24" stroke="#C8102E" stroke-width="1.6" />
          <rect x="15" width="6" height="24" fill="#fff" />
          <rect y="9" width="36" height="6" fill="#fff" />
          <rect x="16.2" width="3.6" height="24" fill="#C8102E" />
          <rect y="10.2" width="36" height="3.6" fill="#C8102E" />
        }
        @default {
          <rect width="36" height="24" fill="#c4c4c4" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      --flag-size: 24px;
      display: inline-flex;
      flex-shrink: 0;
      width: var(--flag-size);
      height: var(--flag-size);
      border-radius: var(--kirby-border-radius-circle, 50%);
      overflow: hidden;
      position: relative;
    }
    :host(.xxs) {
      --flag-size: 16px;
    }
    svg {
      width: 100%;
      height: 100%;
      display: block;
    }
    :host::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      box-shadow: inset 0 0 0 1px rgb(0 0 0 / 16%);
    }
  `,
  host: {
    '[class.xs]': "size === 'xs'",
    '[class.xxs]': "size === 'xxs'",
  },
})
export class FlagAvatarComponent {
  @Input({ required: true }) code!: string;
  @Input() size: FlagAvatarSize = 'xs';

  readonly stripes = [0, 1, 2, 3, 4, 5, 6];
  readonly stars: [number, number][] = Array.from({ length: 12 }, (_, i) => [
    18 + 7 * Math.sin((i * Math.PI) / 6),
    12 - 7 * Math.cos((i * Math.PI) / 6),
  ]);
  readonly dots: [number, number][] = [1, 2, 3].flatMap((r) =>
    [1, 2, 3].map((c): [number, number] => [(c * 16) / 4, (r * 12.9) / 4]),
  );
}
