import {
  Component,
  ElementRef,
  HostListener,
  Injector,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CardComponent } from '@kirbydesign/designsystem/card';
import { ItemComponent } from '@kirbydesign/designsystem/item';
import { DropdownComponent } from '@kirbydesign/designsystem/dropdown';
import { CheckboxComponent } from '@kirbydesign/designsystem/checkbox';
import { IconComponent } from '@kirbydesign/designsystem/icon';
import { ToBodyDirective } from './to-body';
import { ButtonComponent } from '@kirbydesign/designsystem/button';
import { AffixDirective, FormFieldComponent, InputComponent } from '@kirbydesign/designsystem/form-field';
import { ColumnFilter, NumberFilter, NumberOp } from './payments-table';
import { animateReorder, itemAtPointer } from './reorder-motion';
import { SfIconComponent } from './sf-icon';
import { COLUMNS, ColumnDef, ColumnKey, TableConfigService } from './table-config';

type View = 'main' | 'values' | 'freeze' | 'columns';
const VALUES_PER_PAGE = 6;

/** Lille drop-menu under en kolonneoverskrift: filtrering, sortering, fastlåsning og valg af kolonner */
@Component({
  selector: 'app-column-menu',
  imports: [SfIconComponent, CardComponent, ItemComponent, AffixDirective, ButtonComponent, FormFieldComponent, InputComponent, IconComponent, CheckboxComponent, DropdownComponent, ToBodyDirective],
  template: `
    <button
      #trigger
      kirby-button
      size="xs"
      attentionLevel="3"
      class="trigger"
      [class.active]="filtered()"
      [attr.aria-label]="'Menu for kolonnen ' + column().label"
      aria-haspopup="menu"
      [attr.aria-expanded]="open()"
      (click)="toggle($event)"
    >
      <kirby-icon name="more" class="dots"></kirby-icon>
    </button>
    @if (open()) {
      <div
        #panelEl
        appToBody
        class="panel"
        role="menu"
        [style.top.px]="pos().top"
        [style.left.px]="pos().left"
        (click)="$event.stopPropagation()"
      >
        <kirby-card class="card" [style.max-height.px]="maxHeight()">
          @for (v of [view()]; track v) {
          <div class="view" [class.fwd]="dir() === 'fwd'" [class.back-nav]="dir() === 'back'">
          @switch (v) {
            @case ('main') {
              @if (canFilter()) {
                @if (column().filter === 'number') {
                  <div class="numfilter">
                    <kirby-dropdown
                      size="md"
                      [attr.aria-label]="'Filtrér ' + column().label"
                      [items]="numberOps"
                      [selectedIndex]="opIndex()"
                      (change)="setOp($event)"
                    ></kirby-dropdown>
                    <kirby-form-field>
                      <input
                        kirby-input
                        type="number"
                        inputmode="decimal"
                        size="md"
                        [placeholder]="numOp() === 'between' ? 'Fra' : column().label"
                        [attr.aria-label]="numOp() === 'between' ? 'Fra' : column().label"
                        [value]="numA()"
                        (input)="setNumA($any($event.target).value)"
                        (keydown)="$event.stopPropagation()"
                      />
                    </kirby-form-field>
                    @if (numOp() === 'between') {
                      <kirby-form-field>
                        <input
                          kirby-input
                          type="number"
                          inputmode="decimal"
                          size="md"
                          placeholder="Til"
                          aria-label="Til"
                          [value]="numB()"
                          (input)="setNumB($any($event.target).value)"
                          (keydown)="$event.stopPropagation()"
                        />
                      </kirby-form-field>
                    }
                  </div>
                } @else {
                  <kirby-form-field class="search">
                    <input
                      kirby-input
                      type="search"
                      size="md"
                      placeholder="Søg"
                      [attr.aria-label]="'Filtrer ' + column().label + ' med tekst'"
                      [value]="filter()?.text ?? ''"
                      (input)="textChange.emit($any($event.target).value)"
                      (keydown)="$event.stopPropagation()"
                    />
                    <kirby-icon kirby-affix="prefix" name="search"></kirby-icon>
                  </kirby-form-field>
                  @for (s of suggestions(); track s.value) {
                    <kirby-item [selectable]="true" role="option" (click)="textChange.emit(s.value)">
                      {{ s.value }}
                      <span slot="end" class="count">{{ s.count }}</span>
                    </kirby-item>
                  }
                }
                @if (column().filter !== 'text' && column().filter !== 'number') {
                  <kirby-item [selectable]="true" disclosure="arrow-more" role="menuitem" (click)="go('values')">
                    <app-sf-icon slot="start" name="filter" [size]="24"></app-sf-icon>
                    Filtrér
                  </kirby-item>
                }
              }
              @if (canSort()) {
                @for (o of sortOptions(); track o.dir) {
                  <kirby-item [selectable]="true" role="menuitem" [selected]="sortDirection() === o.dir" (click)="pickSort(o.dir)">
                    <app-sf-icon slot="start" [name]="$first ? 'arrow-down' : 'arrow-up'" [size]="24"></app-sf-icon>
                    <span class="sort-label">
                      @if (o.to) {
                        {{ o.from }}<span class="to"> til </span>{{ o.to }}
                      } @else {
                        {{ o.from }}
                      }
                    </span>
                  </kirby-item>
                }
              }
              @if (canFreeze()) {
                <kirby-item [selectable]="true" disclosure="arrow-more" role="menuitem" (click)="go('freeze')">
                  <app-sf-icon slot="start" name="pin" [size]="24"></app-sf-icon>
                  Fastgør kolonne
                </kirby-item>
              }
              @if (canResize()) {
                <kirby-item [selectable]="true" role="menuitem" (click)="done(fit)">
                  <app-sf-icon slot="start" name="fit" [size]="24"></app-sf-icon>
                  Tilpas kolonne til indhold
                </kirby-item>
                <kirby-item [selectable]="true" role="menuitem" (click)="done(fitAll)">
                  <app-sf-icon slot="start" name="fit-all" [size]="24"></app-sf-icon>
                  Tilpas alle kolonner til indhold
                </kirby-item>
              }
              @if (canChoose()) {
                <kirby-item [selectable]="true" disclosure="arrow-more" role="menuitem" (click)="go('columns')">
                  <kirby-icon slot="start" name="checklist"></kirby-icon>
                  Vælg kolonner
                </kirby-item>
              }
            }
            @case ('values') {
              <kirby-item [selectable]="true" class="back" (click)="go('main')">
                <kirby-icon slot="start" name="arrow-back"></kirby-icon>
                Filtrér
              </kirby-item>
              <kirby-item>
                <kirby-checkbox [checked]="allChecked()" [indeterminate]="someChecked()" (checkedChange)="toggleAll($event)">Vælg alle</kirby-checkbox>
                <span slot="end" class="count">{{ values().length }}</span>
              </kirby-item>
              @for (o of pageValues(); track o.value) {
                <kirby-item>
                  <kirby-checkbox [checked]="isChecked(o.value)" (checkedChange)="toggleValue(o.value, $event)">{{ o.value || '(tom)' }}</kirby-checkbox>
                  <span slot="end" class="count">{{ o.count }}</span>
                </kirby-item>
              }
              <div class="pager">
                <button type="button" class="step" aria-label="Forrige side" [disabled]="page() === 0" (click)="page.set(page() - 1)">
                  <kirby-icon name="arrow-back"></kirby-icon>
                </button>
                <span>{{ page() + 1 }} / {{ pageCount() }}</span>
                <button type="button" class="step" aria-label="Næste side" [disabled]="page() >= pageCount() - 1" (click)="page.set(page() + 1)">
                  <kirby-icon name="arrow-more"></kirby-icon>
                </button>
              </div>
            }
            @case ('columns') {
              <kirby-item [selectable]="true" class="back" (click)="go('main')">
                <kirby-icon slot="start" name="arrow-back"></kirby-icon>
                Vælg kolonner
              </kirby-item>
              @for (c of orderedColumns(); track c.key) {
                <kirby-item [attr.data-col]="c.key" [class.dragging]="dragKey() === c.key">
                  <kirby-checkbox
                    [checked]="isShown(c.key)"
                    [disabled]="!!c.noHide"
                    (checkedChange)="config.toggleColumn(c.key, $event)"
                    >{{ c.label }}</kirby-checkbox
                  >
                  @if (config.config().userColumnReorder && isShown(c.key)) {
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
              <kirby-item [selectable]="true" (click)="resetColumns.emit()">Nulstil kolonner</kirby-item>
            }
            @case ('freeze') {
              <kirby-item [selectable]="true" class="back" (click)="go('main')">
                <kirby-icon slot="start" name="arrow-back"></kirby-icon>
                Fastgør kolonne
              </kirby-item>
              <kirby-item [selectable]="true" role="menuitemradio" [selected]="frozenSide() === 'left'" (click)="pickFreeze('left')">Til venstre</kirby-item>
              <kirby-item [selectable]="true" role="menuitemradio" [selected]="frozenSide() === 'right'" (click)="pickFreeze('right')">Til højre</kirby-item>
              <kirby-item [selectable]="!!frozenSide()" [disabled]="!frozenSide()" role="menuitemradio" (click)="pickFreeze(null)">Fjern fastgørelse</kirby-item>
            }
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
    .trigger.active {
      color: var(--kirby-primary);
    }
    .trigger:hover,
    .trigger[aria-expanded='true'] {
      background-color: var(--kirby-semi-light);
    }
    /* Kirby har kun det vandrette ikon (more), så det drejes 90 grader */
    .dots {
      transform: rotate(90deg);
    }
    .panel {
      position: fixed;
      z-index: 2000;
      width: 260px;
      text-align: left;
      font-weight: normal;
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
    .sort-label {
      white-space: pre-wrap;
    }
    .to {
      color: var(--kirby-text-color-semi-dark);
      font-weight: var(--kirby-font-weight-normal);
    }
    .numfilter {
      display: flex;
      flex-direction: column;
      gap: var(--kirby-spacing-xxs);
      margin: var(--kirby-spacing-xs);
    }
    .search {
      display: block;
      margin: var(--kirby-spacing-xs);
    }
    .count {
      color: var(--kirby-text-color-semi-dark);
      font-variant-numeric: tabular-nums;
    }
    .pager {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--kirby-spacing-xxs) var(--kirby-spacing-xs);
      border-bottom: 1px solid var(--kirby-semi-light);
      color: var(--kirby-text-color-semi-dark);
    }
    .step {
      display: inline-flex;
      width: 32px;
      height: 32px;
      align-items: center;
      justify-content: center;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }
    .step:hover:not(:disabled) {
      background: var(--kirby-semi-light);
    }
    .step:disabled {
      opacity: 0.3;
      cursor: default;
    }
  `,
})
export class ColumnMenuComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly config = inject(TableConfigService);
  protected readonly allColumns = COLUMNS;

  // Viste kolonner i brugerens rækkefølge, derefter de skjulte
  protected readonly orderedColumns = computed(() => {
    const visible = this.config.config().visibleColumns;
    const shown = visible.map((k) => COLUMNS.find((c) => c.key === k)).filter((c): c is ColumnDef => !!c);
    return [...shown, ...COLUMNS.filter((c) => !visible.includes(c.key))];
  });

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
      animateReorder(this.panelEl()?.nativeElement, this.injector, () => this.config.moveColumn(key, target));
    }
  }

  protected endDrag() {
    this.dragKey.set(null);
  }

  protected nudge(e: Event, key: ColumnKey, step: number) {
    e.preventDefault();
    const list = this.orderedColumns().filter((c) => this.isShown(c.key));
    const target = list[list.findIndex((c) => c.key === key) + step];
    if (target) animateReorder(this.panelEl()?.nativeElement, this.injector, () => this.config.moveColumn(key, target.key));
  }
  private readonly panelEl = viewChild<ElementRef<HTMLElement>>('panelEl');

  readonly column = input.required<ColumnDef>();
  // Standardsorteringen står øverst: A til Å for tekst, Nyeste først for datoer
  protected readonly sortOptions = computed(() => {
    type Option = { dir: 'asc' | 'desc'; from: string; to?: string };
    const kind = this.column().kind;
    const options: Option[] =
      kind === 'number'
        ? [
            { dir: 'asc', from: 'Lavest', to: 'højest' },
            { dir: 'desc', from: 'Højest', to: 'lavest' },
          ]
        : kind === 'date'
          ? [
              { dir: 'desc', from: 'Nyeste først' },
              { dir: 'asc', from: 'Ældste først' },
            ]
          : [
              { dir: 'asc', from: 'A', to: 'Å' },
              { dir: 'desc', from: 'Å', to: 'A' },
            ];
    return options;
  });

  protected readonly numberOps = ['Højere end', 'Lavere end', 'Mellem', 'Lig med', 'Forskellig fra'];
  private readonly numberOpIds: NumberOp[] = ['gt', 'lt', 'between', 'eq', 'neq'];
  protected readonly numOp = signal<NumberOp>('gt');
  protected readonly numA = signal('');
  protected readonly numB = signal('');
  protected readonly opIndex = computed(() => this.numberOpIds.indexOf(this.numOp()));

  protected setOp(label: string) {
    this.numOp.set(this.numberOpIds[this.numberOps.indexOf(label)] ?? 'gt');
    this.emitNumber();
  }
  protected setNumA(v: string) {
    this.numA.set(v);
    this.emitNumber();
  }
  protected setNumB(v: string) {
    this.numB.set(v);
    this.emitNumber();
  }
  private parse(v: string): number | null {
    const n = v.trim() === '' ? NaN : Number(v.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  private emitNumber() {
    const a = this.parse(this.numA());
    const b = this.parse(this.numB());
    this.numberChange.emit(a === null && b === null ? null : { op: this.numOp(), a, b });
  }
  readonly filter = input<ColumnFilter | undefined>();
  readonly values = input<{ value: string; count: number }[]>([]);
  readonly sortDirection = input<'asc' | 'desc' | null>(null);
  readonly frozenSide = input<'left' | 'right' | null>(null);
  readonly canChoose = input(true);
  readonly canSort = input(true);
  readonly canFilter = input(true);
  readonly canFreeze = input(true);
  readonly canResize = input(false);

  readonly textChange = output<string>();
  readonly valuesChange = output<string[] | null>();
  readonly numberChange = output<NumberFilter | null>();
  readonly sort = output<'asc' | 'desc'>();
  readonly freeze = output<'left' | 'right' | null>();
  readonly fit = output<void>();
  readonly fitAll = output<void>();
  readonly resetColumns = output<void>();

  protected readonly open = signal(false);
  protected readonly view = signal<View>('main');
  protected readonly dir = signal<'fwd' | 'back'>('fwd');

  protected go(v: View) {
    this.dir.set(v === 'main' ? 'back' : 'fwd');
    this.view.set(v);
  }
  protected readonly page = signal(0);
  protected readonly pos = signal({ top: 0, left: 0 });

  // Forslag fra kolonnens værdier, der matcher det indtastede
  protected readonly suggestions = computed(() => {
    const text = (this.filter()?.text ?? '').trim().toLowerCase();
    if (!text) return [];
    return this.values()
      .filter((v) => v.value && v.value.toLowerCase().includes(text) && v.value.toLowerCase() !== text)
      .slice(0, 5);
  });

  protected readonly filtered = computed(() => !!this.filter());
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.values().length / VALUES_PER_PAGE)));
  protected readonly pageValues = computed(() =>
    this.values().slice(this.page() * VALUES_PER_PAGE, (this.page() + 1) * VALUES_PER_PAGE),
  );

  protected toggle(e: Event) {
    e.stopPropagation();
    if (this.open()) return this.close();
    const rect = this.host.nativeElement.getBoundingClientRect();
    const width = 240;
    this.pos.set({
      top: rect.bottom + 4,
      left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
    });
    const num = this.filter()?.num;
    this.numOp.set(num?.op ?? 'gt');
    this.numA.set(num?.a == null ? '' : String(num.a));
    this.numB.set(num?.b == null ? '' : String(num.b));
    this.view.set('main');
    this.dir.set('fwd');
    this.page.set(0);
    this.open.set(true);
    setTimeout(() => this.panelEl()?.nativeElement.querySelector('input')?.focus());
  }

  protected readonly maxHeight = computed(() => Math.max(240, window.innerHeight - this.pos().top - 16));

  protected isShown(key: ColumnKey): boolean {
    return !!COLUMNS.find((c) => c.key === key)?.noHide || this.config.config().visibleColumns.includes(key);
  }

  protected close() {
    this.open.set(false);
  }

  protected pickSort(direction: 'asc' | 'desc') {
    this.sort.emit(direction);
    this.close();
  }

  protected pickFreeze(side: 'left' | 'right' | null) {
    this.freeze.emit(side);
    this.close();
  }

  protected done(output: { emit: () => void }) {
    output.emit();
    this.close();
  }

  // Ingen valgte værdier (null) betyder, at alle værdier vises
  protected isChecked(value: string): boolean {
    const selected = this.filter()?.values;
    return !selected || selected.includes(value);
  }

  protected readonly allChecked = computed(() => {
    const selected = this.filter()?.values;
    return !selected || selected.length === this.values().length;
  });
  protected readonly someChecked = computed(() => !this.allChecked() && (this.filter()?.values?.length ?? 0) > 0);

  protected toggleAll(checked: boolean) {
    this.valuesChange.emit(checked ? null : []);
  }

  protected toggleValue(value: string, checked: boolean) {
    const all = this.values().map((v) => v.value);
    const current = this.filter()?.values ?? all;
    const next = checked ? [...new Set([...current, value])] : current.filter((v) => v !== value);
    this.valuesChange.emit(next.length === all.length ? null : next);
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(e: MouseEvent) {
    if (!this.open()) return;
    const target = e.target as Node;
    if (this.host.nativeElement.contains(target)) return;
    // Valgene i en dropdown i menuen ligger i en popover uden for menuen
    if ((target as Element).closest?.('[role=listbox], .menu-popover')) return;
    this.close();
  }

  @HostListener('document:keydown.escape')
  protected onEscape() {
    if (this.open()) {
      this.close();
      this.host.nativeElement.querySelector('button')?.focus();
    }
  }
}
