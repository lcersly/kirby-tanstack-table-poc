import { Component, ElementRef, HostListener, computed, inject, output, signal } from '@angular/core';
import { ButtonComponent } from '@kirbydesign/designsystem/button';
import { IconComponent } from '@kirbydesign/designsystem/icon';
import { ToggleComponent } from '@kirbydesign/designsystem/toggle';
import { ToBodyDirective } from './to-body';
import { Density, TableConfigService } from './table-config';

const DENSITIES: { value: Density; label: string }[] = [
  { value: 'compact', label: 'Kompakt' },
  { value: 'standard', label: 'Standard' },
  { value: 'spacious', label: 'Luftig' },
];

/** Knap og lille panel, hvor brugeren kan tilpasse tabellens udseende (kun det, udvikleren har tilladt) */
@Component({
  selector: 'app-user-view-menu',
  imports: [ButtonComponent, IconComponent, ToggleComponent, ToBodyDirective],
  template: `
    <button
      kirby-button
      attentionLevel="3"
      aria-label="Tilpas visning"
      title="Tilpas visning"
      aria-haspopup="dialog"
      [attr.aria-expanded]="open()"
      (click)="toggle($event)"
    >
      <kirby-icon name="adjust"></kirby-icon>
    </button>
    @if (open()) {
      <div
        appToBody
        class="panel"
        role="dialog"
        aria-label="Tilpas tabellens udseende"
        [style.top.px]="pos().top"
        [style.left.px]="pos().left"
        (click)="$event.stopPropagation()"
      >
        @if (cfg().userDensity) {
          <div class="group">
            <div class="label">Rækkehøjde</div>
            <div class="seg" role="radiogroup" aria-label="Rækkehøjde">
              @for (d of densities; track d.value) {
                <button
                  type="button"
                  role="radio"
                  [attr.aria-checked]="view().density === d.value"
                  [class.on]="view().density === d.value"
                  (click)="service.setOverride('density', d.value)"
                >
                  {{ d.label }}
                </button>
              }
            </div>
          </div>
        }
        @if (cfg().userZebra) {
          <div class="row">
            <span>Zebrastriber</span>
            <kirby-toggle aria-label="Zebrastriber" [checked]="view().zebra" (checkedChange)="service.setOverride('zebra', $event)"></kirby-toggle>
          </div>
        }
        @if (cfg().userDividers) {
          <div class="row">
            <span>Kolonnelinjer</span>
            <kirby-toggle aria-label="Kolonnelinjer" [checked]="view().columnDividers" (checkedChange)="service.setOverride('columnDividers', $event)"></kirby-toggle>
          </div>
        }
        @if (cfg().userScroll) {
          <div class="row">
            <span>Horisontal rulning</span>
            <kirby-toggle
              aria-label="Horisontal rulning"
              [checked]="view().columnOverflow === 'scroll'"
              (checkedChange)="service.setOverride('columnOverflow', $event ? 'scroll' : 'hide')"
            ></kirby-toggle>
          </div>
        }
        @if (cfg().userColumnChoice) {
          <button type="button" class="mi" (click)="chooseColumns.emit(); close()">Vælg kolonner</button>
        }
        @if (cfg().userColumnWidth) {
          <p class="hint">Træk i kanten af en kolonneoverskrift for at ændre bredden.</p>
        }
        <hr />
        <button type="button" class="mi" (click)="service.resetUserView()">Nulstil visning</button>
      </div>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    .panel {
      position: fixed;
      z-index: 2000;
      width: 280px;
      padding: var(--kirby-spacing-xs) 0;
      border-radius: 8px;
      background: var(--kirby-white);
      color: var(--kirby-text-color);
      box-shadow: 0 4px 16px rgb(0 0 0 / 16%);
      font-size: var(--kirby-font-size-s);
    }
    .group {
      padding: var(--kirby-spacing-xs) var(--kirby-spacing-s);
    }
    .label {
      margin-bottom: var(--kirby-spacing-xxs);
      color: var(--kirby-semi-dark);
    }
    .seg {
      display: flex;
      gap: 2px;
      padding: 2px;
      border-radius: 8px;
      background: var(--kirby-semi-light);
    }
    .seg button {
      flex: 1;
      height: 28px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      font: inherit;
      color: inherit;
      cursor: pointer;
    }
    .seg button.on {
      background: var(--kirby-white);
      font-weight: var(--kirby-font-weight-bold);
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 40px;
      padding: 0 var(--kirby-spacing-s);
    }
    .mi {
      display: block;
      width: 100%;
      min-height: 40px;
      padding: 0 var(--kirby-spacing-s);
      border: 0;
      background: transparent;
      font: inherit;
      color: inherit;
      text-align: left;
      cursor: pointer;
    }
    .mi:hover {
      background: var(--kirby-background-color);
    }
    .hint {
      margin: 0;
      padding: var(--kirby-spacing-xs) var(--kirby-spacing-s);
      color: var(--kirby-semi-dark);
    }
    hr {
      margin: var(--kirby-spacing-xs) 0;
      border: 0;
      border-top: 1px solid var(--kirby-semi-light);
    }
  `,
})
export class UserViewMenuComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly service = inject(TableConfigService);
  protected readonly cfg = this.service.config;
  protected readonly view = this.service.effective;
  protected readonly densities = DENSITIES;
  readonly chooseColumns = output<void>();

  protected readonly open = signal(false);
  protected readonly pos = signal({ top: 0, left: 0 });
  /** Knappen vises kun, når brugeren må ændre mindst én ting */
  readonly any = computed(() => {
    const c = this.cfg();
    return c.userColumnWidth || c.userColumnChoice || c.userDensity || c.userZebra || c.userDividers || c.userScroll;
  });

  protected toggle(e: Event) {
    e.stopPropagation();
    if (this.open()) return this.close();
    const rect = this.host.nativeElement.getBoundingClientRect();
    this.pos.set({ top: rect.bottom + 4, left: Math.max(8, Math.min(rect.right - 280, window.innerWidth - 288)) });
    this.open.set(true);
  }

  protected close() {
    this.open.set(false);
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(e: MouseEvent) {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.close();
  }

  @HostListener('document:keydown.escape')
  protected onEscape() {
    this.close();
  }
}
