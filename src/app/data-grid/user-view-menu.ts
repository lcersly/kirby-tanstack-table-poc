import { Component, ElementRef, HostListener, Injector, computed, inject, signal, viewChild } from '@angular/core';
import { ButtonComponent } from '@kirbydesign/designsystem/button';
import { CardComponent } from '@kirbydesign/designsystem/card';
import { CheckboxComponent } from '@kirbydesign/designsystem/checkbox';
import { DropdownComponent } from '@kirbydesign/designsystem/dropdown';
import { ItemComponent } from '@kirbydesign/designsystem/item';
import { IconComponent } from '@kirbydesign/designsystem/icon';
import { ToggleComponent } from '@kirbydesign/designsystem/toggle';
import { animateReorder, itemAtPointer } from './reorder-motion';
import { ToBodyDirective } from './to-body';
import { COLUMNS, ColumnDef, ColumnKey, Density, TableConfigService } from './table-config';

const DENSITIES: { value: Density; label: string }[] = [
  { value: 'compact', label: 'Kompakt' },
  { value: 'standard', label: 'Standard' },
  { value: 'spacious', label: 'Luftig' },
];

/** Knap og lille panel, hvor brugeren kan tilpasse tabellens udseende (kun det, udvikleren har tilladt) */
@Component({
  selector: 'app-user-view-menu',
  imports: [CheckboxComponent, CardComponent, DropdownComponent, ItemComponent, ButtonComponent, IconComponent, ToggleComponent, ToBodyDirective],
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
        #panelEl
        class="panel"
        role="dialog"
        aria-label="Tilpas tabellens udseende"
        [style.top.px]="pos().top"
        [style.left.px]="pos().left"
        (click)="$event.stopPropagation()"
      >
        <kirby-card class="card" [style.max-height.px]="maxHeight()">
          @for (v of [view2()]; track v) {
          <div class="view" [class.fwd]="dir() === 'fwd'">
          @if (v === 'columns') {
            <kirby-item [selectable]="true" class="back" (click)="go('main')">
              <kirby-icon slot="start" name="arrow-back"></kirby-icon>
              Vælg kolonner
            </kirby-item>
            @for (c of orderedColumns(); track c.key) {
              <kirby-item [attr.data-col]="c.key" [class.dragging]="dragKey() === c.key">
                <kirby-checkbox
                  [checked]="isShown(c.key)"
                  [disabled]="!!c.noHide"
                  (checkedChange)="service.toggleColumn(c.key, $event)"
                  >{{ c.label }}</kirby-checkbox
                >
                @if (cfg().userColumnReorder && isShown(c.key)) {
                  <span
                    slot="end"
                    class="handle"
                    role="button"
                    tabindex="0"
                    [attr.aria-label]="'Flyt kolonnen ' + c.label + '. Brug piletaster eller træk.'"
                    (pointerdown)="startDrag($event, c.key)"
                    (pointermove)="moveDrag($event)"
                    (pointerup)="endDrag()"
                    (pointercancel)="endDrag()"
                    (keydown.arrowup)="nudge($event, c.key, -1)"
                    (keydown.arrowdown)="nudge($event, c.key, 1)"
                  >
                    <kirby-icon name="reorder"></kirby-icon>
                  </span>
                }
              </kirby-item>
            }
            <kirby-item [selectable]="true" (click)="service.resetColumns()">Nulstil kolonner</kirby-item>
          } @else {
          @if (cfg().userDensity) {
            <kirby-item>
              <div class="kirby-text-normal">Rækkehøjde</div>
              <kirby-dropdown
                slot="end"
                class="value"
                aria-label="Rækkehøjde"
                [items]="densityLabels"
                [selectedIndex]="densityIndex()"
                (change)="service.setOverride('density', densities[densityLabels.indexOf($event)].value)"
              ></kirby-dropdown>
            </kirby-item>
          }
          @if (cfg().userZebra) {
            <kirby-item>
              <div class="kirby-text-normal">Zebrastriber</div>
              <kirby-toggle slot="end" aria-label="Zebrastriber" [checked]="view().zebra" (checkedChange)="service.setOverride('zebra', $event)"></kirby-toggle>
            </kirby-item>
          }
          @if (cfg().userDividers) {
            <kirby-item>
              <div class="kirby-text-normal">Kolonnelinjer</div>
              <kirby-toggle slot="end" aria-label="Kolonnelinjer" [checked]="view().columnDividers" (checkedChange)="service.setOverride('columnDividers', $event)"></kirby-toggle>
            </kirby-item>
          }
          @if (cfg().userScroll) {
            <kirby-item>
              <div class="kirby-text-normal">Horisontal rulning</div>
              <kirby-toggle
                slot="end"
                aria-label="Horisontal rulning"
                [checked]="view().columnOverflow === 'scroll'"
                (checkedChange)="service.setOverride('columnOverflow', $event ? 'scroll' : 'hide')"
              ></kirby-toggle>
            </kirby-item>
          }
          @if (cfg().userColumnChoice) {
            <kirby-item [selectable]="true" disclosure="arrow-more" (click)="go('columns')">
              <kirby-icon slot="start" name="checklist"></kirby-icon>
              Vælg kolonner
            </kirby-item>
          }
          <kirby-item [selectable]="true" (click)="service.resetUserView()">Nulstil visning</kirby-item>
          }
          </div>
          }
        </kirby-card>
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
      width: 320px;
    }
    .card {
      display: block;
      overflow-x: hidden;
      overflow-y: auto;
      box-shadow: 0 4px 16px rgb(0 0 0 / 16%);
    }
    kirby-item:not(:last-child) {
      border-bottom: 1px solid var(--kirby-semi-light);
    }
    .view {
      animation: slide-in-back 240ms ease-out;
    }
    .view.fwd {
      animation-name: slide-in-forward;
    }
    @keyframes slide-in-forward {
      from {
        opacity: 0;
        transform: translateX(32px);
      }
    }
    @keyframes slide-in-back {
      from {
        opacity: 0;
        transform: translateX(-32px);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .view {
        animation: none;
      }
    }
    kirby-item.back {
      font-weight: var(--kirby-font-weight-bold);
    }
    .handle {
      display: inline-flex;
      align-items: center;
      cursor: grab;
      touch-action: none;
      color: var(--kirby-text-color-semi-dark);
    }
    .dragging {
      background-color: var(--kirby-white);
      box-shadow: var(--kirby-elevation-4, var(--kirby-elevation-2));
      transform: scale(1.03);
      position: relative;
      z-index: 1;
    }
    .value {
      min-width: 130px;
    }
    .hint {
      margin: 0;
      padding: var(--kirby-spacing-xs) var(--kirby-spacing-m);
      font-size: var(--kirby-font-size-s);
      color: var(--kirby-text-color-semi-dark);
      border-bottom: 1px solid var(--kirby-semi-light);
    }
  `,
})
export class UserViewMenuComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly service = inject(TableConfigService);
  protected readonly cfg = this.service.config;
  protected readonly view = this.service.effective;
  protected readonly densities = DENSITIES;
  protected readonly densityLabels = DENSITIES.map((d) => d.label);
  protected readonly densityIndex = computed(() => DENSITIES.findIndex((d) => d.value === this.view().density));
  protected readonly view2 = signal<'main' | 'columns'>('main');
  protected readonly dir = signal<'fwd' | 'back'>('fwd');

  protected go(v: 'main' | 'columns') {
    this.dir.set(v === 'main' ? 'back' : 'fwd');
    this.view2.set(v);
  }
  protected readonly orderedColumns = computed(() => {
    const visible = this.cfg().visibleColumns;
    const shown = visible.map((k) => COLUMNS.find((c) => c.key === k)).filter((c): c is ColumnDef => !!c);
    return [...shown, ...COLUMNS.filter((c) => !visible.includes(c.key))];
  });
  private readonly injector = inject(Injector);
  private readonly panelEl = viewChild<ElementRef<HTMLElement>>('panelEl');
  protected readonly dragKey = signal<ColumnKey | null>(null);

  protected startDrag(e: PointerEvent, key: ColumnKey) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.dragKey.set(key);
  }

  protected moveDrag(e: PointerEvent) {
    const key = this.dragKey();
    if (!key) return;
    const el = itemAtPointer(this.panelEl()?.nativeElement, e.clientY);
    const target = el?.dataset['col'] as ColumnKey | undefined;
    if (target && target !== key && this.isShown(target)) {
      animateReorder(this.panelEl()?.nativeElement, this.injector, () => this.service.moveColumn(key, target));
    }
  }

  protected endDrag() {
    this.dragKey.set(null);
  }

  protected nudge(e: Event, key: ColumnKey, step: number) {
    e.preventDefault();
    const list = this.orderedColumns().filter((c) => this.isShown(c.key));
    const target = list[list.findIndex((c) => c.key === key) + step];
    if (target) animateReorder(this.panelEl()?.nativeElement, this.injector, () => this.service.moveColumn(key, target.key));
  }
  protected readonly maxHeight = computed(() => Math.max(240, window.innerHeight - this.pos().top - 16));

  protected isShown(key: ColumnKey): boolean {
    return !!COLUMNS.find((c) => c.key === key)?.noHide || this.cfg().visibleColumns.includes(key);
  }

  protected readonly open = signal(false);
  protected readonly pos = signal({ top: 0, left: 0 });
  /** Knappen vises kun, når brugeren må ændre mindst én ting */
  readonly any = computed(() => {
    const c = this.cfg();
    return c.userColumnWidth || c.userColumnReorder || c.userColumnChoice || c.userDensity || c.userZebra || c.userDividers || c.userScroll;
  });

  protected toggle(e: Event) {
    e.stopPropagation();
    if (this.open()) return this.close();
    const rect = this.host.nativeElement.getBoundingClientRect();
    this.pos.set({ top: rect.bottom + 4, left: Math.max(8, Math.min(rect.right - 320, window.innerWidth - 328)) });
    this.view2.set('main');
    this.dir.set('fwd');
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
