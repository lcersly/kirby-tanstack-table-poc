import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CheckboxComponent } from '@kirbydesign/designsystem/checkbox';
import { IconComponent } from '@kirbydesign/designsystem/icon';
import { ToBodyDirective } from './to-body';
import { ButtonComponent } from '@kirbydesign/designsystem/button';
import { AffixDirective, FormFieldComponent, InputComponent } from '@kirbydesign/designsystem/form-field';
import { ColumnFilter } from './payments-table';
import { ColumnDef } from './table-config';

type View = 'main' | 'values' | 'freeze';
const VALUES_PER_PAGE = 6;

/** Lille drop-menu under en kolonneoverskrift: filtrering, sortering, fastlåsning og valg af kolonner */
@Component({
  selector: 'app-column-menu',
  imports: [AffixDirective, ButtonComponent, FormFieldComponent, InputComponent, IconComponent, CheckboxComponent, ToBodyDirective],
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
        appToBody
        class="panel"
        role="menu"
        [style.top.px]="pos().top"
        [style.left.px]="pos().left"
        (click)="$event.stopPropagation()"
      >
        @switch (view()) {
          @case ('main') {
            <kirby-form-field class="search">
              <input
                kirby-input
                type="search"
                size="md"
                placeholder="Filtrer med tekst"
                [attr.aria-label]="'Filtrer ' + column().label + ' med tekst'"
                [value]="filter()?.text ?? ''"
                (input)="textChange.emit($any($event.target).value)"
                (keydown)="$event.stopPropagation()"
              />
              <kirby-icon kirby-affix="prefix" name="search"></kirby-icon>
            </kirby-form-field>
            <button type="button" class="mi" role="menuitem" (click)="view.set('values')">
              <span>Filtrer pr. værdi</span>
              <kirby-icon name="arrow-more"></kirby-icon>
            </button>
            <hr />
            <button type="button" class="mi" role="menuitem" [class.on]="sortDirection() === 'desc'" (click)="pickSort('desc')">
              <span>Sortér faldende</span>
              <kirby-icon name="arrow-down"></kirby-icon>
            </button>
            <button type="button" class="mi" role="menuitem" [class.on]="sortDirection() === 'asc'" (click)="pickSort('asc')">
              <span>Sortér stigende</span>
              <kirby-icon name="arrow-up"></kirby-icon>
            </button>
            <button type="button" class="mi" role="menuitem" (click)="view.set('freeze')">
              <span>Frys kolonne</span>
              <kirby-icon name="arrow-more"></kirby-icon>
            </button>
            @if (canChoose()) {
              <hr />
              <button type="button" class="mi" role="menuitem" (click)="done(chooseColumns)">Vælg kolonner</button>
              <button type="button" class="mi" role="menuitem" (click)="done(resetColumns)">Nulstil kolonner</button>
            }
          }
          @case ('values') {
            <button type="button" class="mi back" (click)="view.set('main')">
              <kirby-icon name="arrow-back"></kirby-icon>
              <span>Filtrer pr. værdi</span>
            </button>
            <hr />
            @for (o of pageValues(); track o.value) {
              <div class="value">
                <kirby-checkbox
                  [checked]="isChecked(o.value)"
                  (checkedChange)="toggleValue(o.value, $event)"
                  >{{ o.value || '(tom)' }}</kirby-checkbox
                >
                <span class="count">{{ o.count }}</span>
              </div>
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
            <hr />
            <button type="button" class="mi" [disabled]="!filter()?.values" (click)="valuesChange.emit(null)">
              Vis alle værdier
            </button>
          }
          @case ('freeze') {
            <button type="button" class="mi back" (click)="view.set('main')">
              <kirby-icon name="arrow-back"></kirby-icon>
              <span>Frys kolonne</span>
            </button>
            <hr />
            <button type="button" class="mi" role="menuitemradio" [class.on]="frozenSide() === 'left'" (click)="pickFreeze('left')">Til venstre</button>
            <button type="button" class="mi" role="menuitemradio" [class.on]="frozenSide() === 'right'" (click)="pickFreeze('right')">Til højre</button>
            <button type="button" class="mi" role="menuitemradio" [disabled]="!frozenSide()" (click)="pickFreeze(null)">Fjern frysning</button>
          }
        }
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
    /* Kirby har kun det vandrette ikon (more), så det drejes 90 grader */
    .dots {
      transform: rotate(90deg);
    }
    .panel {
      position: fixed;
      z-index: 2000;
      width: 240px;
      padding: var(--kirby-spacing-xs) 0;
      border-radius: 8px;
      background: var(--kirby-white);
      color: var(--kirby-text-color);
      box-shadow: 0 4px 16px rgb(0 0 0 / 16%);
      font-size: var(--kirby-font-size-s);
      text-align: left;
      font-weight: normal;
    }
    hr {
      margin: var(--kirby-spacing-xs) 0;
      border: 0;
      border-top: 1px solid var(--kirby-semi-light);
    }
    .mi {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--kirby-spacing-xs);
      width: 100%;
      min-height: 36px;
      padding: 0 var(--kirby-spacing-s);
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .mi:hover:not(:disabled) {
      background: var(--kirby-background-color);
    }
    .mi:disabled {
      opacity: 0.4;
      cursor: default;
    }
    .mi.on {
      font-weight: var(--kirby-font-weight-bold);
      color: var(--kirby-primary);
    }
    .mi.back {
      justify-content: flex-start;
      font-weight: var(--kirby-font-weight-bold);
    }
    .search {
      display: block;
      margin: 0 var(--kirby-spacing-xs) var(--kirby-spacing-xs);
    }
    .value {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--kirby-spacing-xs);
      min-height: 36px;
      padding: 0 var(--kirby-spacing-s);
    }
    .count {
      color: var(--kirby-semi-dark);
      font-variant-numeric: tabular-nums;
    }
    .pager {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 var(--kirby-spacing-xs);
      color: var(--kirby-semi-dark);
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
    .step:disabled {
      opacity: 0.3;
      cursor: default;
    }
  `,
})
export class ColumnMenuComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly column = input.required<ColumnDef>();
  readonly filter = input<ColumnFilter | undefined>();
  readonly values = input<{ value: string; count: number }[]>([]);
  readonly sortDirection = input<'asc' | 'desc' | null>(null);
  readonly frozenSide = input<'left' | 'right' | null>(null);
  readonly canChoose = input(true);

  readonly textChange = output<string>();
  readonly valuesChange = output<string[] | null>();
  readonly sort = output<'asc' | 'desc'>();
  readonly freeze = output<'left' | 'right' | null>();
  readonly chooseColumns = output<void>();
  readonly resetColumns = output<void>();

  protected readonly open = signal(false);
  protected readonly view = signal<View>('main');
  protected readonly page = signal(0);
  protected readonly pos = signal({ top: 0, left: 0 });

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
    this.view.set('main');
    this.page.set(0);
    this.open.set(true);
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
