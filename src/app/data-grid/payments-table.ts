import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  inject,
  effect,
  signal,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ButtonComponent, ButtonSize } from '@kirbydesign/designsystem/button';
import { CheckboxComponent } from '@kirbydesign/designsystem/checkbox';
import { FlagComponent } from '@kirbydesign/designsystem/flag';
import { IconComponent } from '@kirbydesign/designsystem/icon';
import { ItemComponent } from '@kirbydesign/designsystem/item';
import { MenuComponent } from '@kirbydesign/designsystem/menu';
import { CardComponent } from '@kirbydesign/designsystem/card';
import { ModalController } from '@kirbydesign/designsystem/modal';
import { CurrencyComponent } from './currency';
import { RecipientCheckComponent } from './recipient-check';
import {
  FlagColor,
  Payment,
  PaymentStatus,
  STATUS_COLORS,
  STATUS_NEEDS_ATTENTION,
  canApprove,
  canEdit,
  canStop,
  formatAmount,
  formatDate,
  nextStatusAfterApproval,
} from './payments';
import { BulkSummaryComponent } from './bulk-summary';
import { SegmentedControlComponent } from '@kirbydesign/designsystem/segmented-control';
import { SpinnerComponent } from '@kirbydesign/designsystem/spinner';
import { AffixDirective, FormFieldComponent, InputComponent } from '@kirbydesign/designsystem/form-field';
import { UserViewMenuComponent } from './user-view-menu';
import { ColumnMenuComponent } from './column-menu';
import { ColumnChooserComponent } from './column-chooser';
import { ToBodyDirective } from './to-body';
import { PaymentDetailComponent } from './payment-detail';
import { PaymentsService } from './payments.service';
import { COLUMNS, ColumnDef, ColumnKey, TableConfigService } from './table-config';

const SMALL_SCREEN_MAX = 768;
const SELECT_WIDTH = 56;
// [OPEN POINT: "I dag" er fast i prototypen, så der er både kommende og tidligere betalinger]
const MOCK_TODAY = '2026-10-14';
export const QUICK_FILTERS = [
  { id: 'upcoming', label: 'Kommende', test: (p: Payment) => p.date > MOCK_TODAY },
  { id: 'missing', label: 'Mangler godkendelse', test: (p: Payment) => p.status.startsWith('Mangler') },
  // [OPEN POINT: Der findes ingen status for "Returneret" endnu, så Afvist og Fejl bruges]
  { id: 'rejected', label: 'Afviste/returnerede', test: (p: Payment) => p.status === 'Afvist' || p.status === 'Fejl' },
] as const;
// Margen, så kolonnernes faktiske indhold (fx kolonnemenuen) ikke giver sidelæns rulning
const FIT_MARGIN = 32;

export interface ColumnFilter {
  text: string;
  values: string[] | null;
}
// Knapperne skifter trin, når tabellen bliver smallere: ikon + tekst, kun tekst, kun ikon, overflow
const ACTION_STEPS = [
  { display: 'full', width: 360, minTable: 1300 },
  { display: 'label', width: 250, minTable: 1000 },
  { display: 'icon', width: 150, minTable: 760 },
] as const;
const DISCLOSURE_WIDTH = 56;
const INLINE_PANEL_WIDTH = 400;
const PAGE_SIZE = 20;
const VIRTUAL_BUFFER = 8;
const ROW_HEIGHTS = { compact: 32, standard: 44, spacious: 64 } as const;

@Component({
  selector: 'app-payments-table',
  imports: [
    AffixDirective,
    FormFieldComponent,
    InputComponent,
    ColumnMenuComponent,
    UserViewMenuComponent,
    BulkSummaryComponent,
    SegmentedControlComponent,
    SpinnerComponent,
    ToBodyDirective,
    NgTemplateOutlet,
    ButtonComponent,
    CheckboxComponent,
    FlagComponent,
    IconComponent,
    ItemComponent,
    MenuComponent,
    CardComponent,
    PaymentDetailComponent,
    CurrencyComponent,
    RecipientCheckComponent,
  ],
  host: {
    '[class.on-plain]': "cfg().container === 'canvas'",
    '[class.on-card]': "cfg().container === 'card'",
    '[class.on-stroked]': "cfg().container === 'stroked-card'",
    '[class.on-canvas]': "cfg().container !== 'card'",
  },
  templateUrl: './payments-table.html',
  styleUrl: './payments-table.scss',
})
export class PaymentsTableComponent implements OnInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly configService = inject(TableConfigService);
  readonly cfg = this.configService.effective;
  readonly allColumns = COLUMNS;

  private readonly service = inject(PaymentsService);
  private readonly modalController = inject(ModalController);
  readonly payments = this.service.payments;
  readonly detailId = signal<number | null>(null);
  readonly selected = signal<ReadonlySet<number>>(new Set());
  readonly sortKey = signal<ColumnKey>('date');
  readonly sortDirection = signal<'asc' | 'desc'>('desc');
  private readonly width = signal(1200);
  private readonly viewportWidth = signal(window.innerWidth);
  private observer?: ResizeObserver;

  readonly detailMode = computed(() => this.cfg().detailMode);
  readonly pageMode = computed(() => this.detailMode() === 'page');
  readonly detailPayment = computed(() => this.service.get(this.detailId() ?? undefined));
  /** Flere valgte betalinger vises som overblik i et inline-panel */
  readonly bulkOpen = computed(() => this.selected().size >= 1);
  readonly inlineOpen = computed(
    () => this.bulkOpen() || (this.detailMode() === 'inline' && this.detailPayment() !== undefined),
  );
  readonly sideOpen = computed(
    () =>
      !this.bulkOpen() &&
      (this.detailMode() === 'side-modal' || this.detailMode() === 'side-nonmodal') &&
      this.detailPayment() !== undefined,
  );
  readonly pageDetailId = this.service.pageDetailId;
  readonly pageOpen = computed(
    () => this.pageMode() && this.service.get(this.pageDetailId() ?? undefined) !== undefined,
  );
  // Når kolonner skjules ved pladsmangel (eller inline-panelet er åbent), må tabellen aldrig rulle sidelæns
  readonly fitColumns = computed(() => this.cfg().columnOverflow === 'hide' || this.inlineOpen());
  readonly flagSize = computed(() => 'xs' as const);

  private effWidth(c: ColumnDef): number {
    return this.widthOf(c) ?? c.width;
  }

  readonly columns = computed<ColumnDef[]>(() => {
    const chosen = COLUMNS.filter((c) => c.noHide || this.cfg().visibleColumns.includes(c.key));
    // Inline-panelet skubber tabellen og skjuler de mindst vigtige kolonner
    const hide = this.cfg().columnOverflow === 'hide' || this.inlineOpen();
    if (!hide) return chosen;
    const fixed = SELECT_WIDTH + this.actionsWidth() + FIT_MARGIN;
    let available = this.width() - (this.inlineOpen() ? INLINE_PANEL_WIDTH : 0) - fixed;
    const keep = new Set<ColumnKey>();
    for (const c of chosen.filter((c) => c.noHide)) {
      keep.add(c.key);
      available -= this.effWidth(c);
    }
    for (const c of [...chosen].sort((a, b) => a.priority - b.priority)) {
      if (!keep.has(c.key) && this.effWidth(c) <= available) {
        keep.add(c.key);
        available -= this.effWidth(c);
      }
    }
    return chosen.filter((c) => keep.has(c.key));
  });

  readonly showCards = computed(
    () => this.cfg().cardsOnSmallScreens && this.viewportWidth() < SMALL_SCREEN_MAX,
  );

  readonly actionsDisplay = computed<'full' | 'label' | 'icon' | 'menu'>(() => {
    if (this.cfg().actionsOverflow) return 'menu';
    const available = this.width() - (this.inlineOpen() ? INLINE_PANEL_WIDTH : 0);
    return ACTION_STEPS.find((s) => available >= s.minTable)?.display ?? 'menu';
  });

  private readonly actionsWidth = computed(() => {
    if (this.pageMode()) return DISCLOSURE_WIDTH;
    return ACTION_STEPS.find((s) => s.display === this.actionsDisplay())?.width ?? DISCLOSURE_WIDTH;
  });

  readonly avatarSize = computed(() => (this.cfg().density === 'compact' ? 'xxs' : 'xs'));

  readonly rows = computed(() => {
    const key = this.sortKey();
    const dir = this.sortDirection() === 'asc' ? 1 : -1;
    const filters = this.filters();
    const quick = QUICK_FILTERS.filter((q) => this.quick().has(q.id));
    const term = this.search().trim().toLowerCase();
    return this.payments()
      .filter((p) => this.matches(p, filters))
      .filter((p) => !quick.length || quick.some((q) => q.test(p)))
      .filter((p) => !term || COLUMNS.some((c) => this.plainValue(p, c.key).toLowerCase().includes(term)))
      .sort((a, b) => {
      const av = a[key as keyof Payment];
      const bv = b[key as keyof Payment];
      const result =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), 'da');
      return result * dir || a.id - b.id;
    });
  });

  // Filtre pr. kolonne: tekstsøgning og valgte værdier (null = alle værdier)
  readonly filters = signal<Partial<Record<ColumnKey, ColumnFilter>>>({});
  readonly quickFilters = QUICK_FILTERS;
  readonly quick = signal<ReadonlySet<string>>(new Set());
  readonly search = signal('');
  readonly frozen = signal<Partial<Record<ColumnKey, 'left' | 'right'>>>({});
  private readonly colWidths = signal<Record<string, number>>({});
  private readonly pinnedCfg = computed(() => this.cfg().pinned);

  private matches(p: Payment, filters: Partial<Record<ColumnKey, ColumnFilter>>, except?: ColumnKey): boolean {
    for (const col of COLUMNS) {
      const f = filters[col.key];
      if (!f || col.key === except) continue;
      const value = this.plainValue(p, col.key);
      if (f.text && !value.toLowerCase().includes(f.text.toLowerCase())) return false;
      if (f.values && !f.values.includes(value)) return false;
    }
    return true;
  }

  /** Værdier og antal pr. kolonne. Tager højde for filtrene på de øvrige kolonner */
  readonly valueOptions = computed(() => {
    const filters = this.filters();
    const result = {} as Record<ColumnKey, { value: string; count: number }[]>;
    for (const col of COLUMNS) {
      const counts = new Map<string, number>();
      for (const p of this.payments()) {
        if (!this.matches(p, filters, col.key)) continue;
        const v = this.plainValue(p, col.key);
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      result[col.key] = [...counts]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => a.value.localeCompare(b.value, 'da', { numeric: true }));
    }
    return result;
  });

  readonly pinLeft = computed(() => Object.values(this.frozen()).includes('left'));
  readonly pinRight = computed(
    () => this.pinnedCfg() === 'both' || Object.values(this.frozen()).includes('right'),
  );

  /** Sticky-placering for fastlåste kolonner, ud fra de målte kolonnebredder */
  readonly frozenInfo = computed(() => {
    const f = this.frozen();
    const w = this.colWidths();
    const cols = this.columns();
    const info: Partial<Record<ColumnKey, { side: 'left' | 'right'; offset: number; edge: boolean }>> = {};
    let left = SELECT_WIDTH;
    const lefts = cols.filter((c) => f[c.key] === 'left');
    lefts.forEach((c, i) => {
      info[c.key] = { side: 'left', offset: left, edge: i === lefts.length - 1 };
      left += w[c.key] ?? c.width;
    });
    let right = w['__actions'] ?? this.actionsWidth();
    const rights = cols.filter((c) => f[c.key] === 'right');
    for (let i = rights.length - 1; i >= 0; i--) {
      info[rights[i].key] = { side: 'right', offset: right, edge: i === 0 };
      right += w[rights[i].key] ?? rights[i].width;
    }
    return info;
  });

  readonly quickItems = [{ id: 'all', text: 'Alle' }, ...QUICK_FILTERS.map((q) => ({ id: q.id as string, text: q.label as string }))];
  readonly quickIndex = computed(() => {
    const id = [...this.quick()][0];
    return id ? this.quickItems.findIndex((q) => q.id === id) : 0;
  });

  setQuick(index: number) {
    const id = this.quickItems[index]?.id;
    this.quick.set(!id || id === 'all' ? new Set() : new Set([id]));
  }

  // Kolonnebredde: brugerens egen bredde (hvis tilladt) ellers standardbredden
  widthOf(col: ColumnDef): number | null {
    return this.cfg().userColumnWidth ? (this.configService.userWidths()[col.key] ?? null) : null;
  }

  startResize(e: PointerEvent, col: ColumnDef) {
    e.preventDefault();
    e.stopPropagation();
    const th = (e.target as HTMLElement).closest('th')!;
    const startX = e.clientX;
    const startW = th.getBoundingClientRect().width;
    const move = (ev: PointerEvent) =>
      this.configService.setUserWidth(col.key, startW + (ev.clientX - startX) * (col.align === 'right' ? 1 : 1));
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      setTimeout(() => this.updateShadows());
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }

  resetWidth(col: ColumnDef, e: Event) {
    e.stopPropagation();
    this.configService.setUserWidth(col.key, null);
  }

  setTextFilter(key: ColumnKey, text: string) {
    this.filters.update((f) => this.withFilter(f, key, { text, values: f[key]?.values ?? null }));
  }

  setValueFilter(key: ColumnKey, values: string[] | null) {
    this.filters.update((f) => this.withFilter(f, key, { text: f[key]?.text ?? '', values }));
  }

  private withFilter(
    all: Partial<Record<ColumnKey, ColumnFilter>>,
    key: ColumnKey,
    next: ColumnFilter,
  ): Partial<Record<ColumnKey, ColumnFilter>> {
    const copy = { ...all };
    if (!next.text && !next.values) delete copy[key];
    else copy[key] = next;
    return copy;
  }

  sortBy(key: ColumnKey, direction: 'asc' | 'desc') {
    this.sortKey.set(key);
    this.sortDirection.set(direction);
  }

  setFrozen(key: ColumnKey, side: 'left' | 'right' | null) {
    this.frozen.update((f) => {
      const copy = { ...f };
      if (side) copy[key] = side;
      else delete copy[key];
      return copy;
    });
  }

  chooseColumns() {
    this.modalController.showModal({
      component: ColumnChooserComponent,
      flavor: 'modal',
      size: 'small',
      interactWithBackground: true,
    });
  }

  resetColumns() {
    this.configService.resetColumns();
    this.filters.set({});
    this.frozen.set(this.defaultFrozen());
  }

  private defaultFrozen(): Partial<Record<ColumnKey, 'left' | 'right'>> {
    return this.pinnedCfg() === 'none' ? {} : { recipient: 'left' };
  }

  readonly loading = computed(() => this.cfg().loading);
  readonly page = signal(0);
  readonly lazyCount = signal(PAGE_SIZE);
  readonly loadingMore = signal(false);
  private readonly vRange = signal({ start: 0, end: 40 });

  readonly rowHeight = computed(() => ROW_HEIGHTS[this.cfg().density]);
  private readonly virtual = computed(() => this.loading() === 'virtual' && !this.showCards());
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.rows().length / PAGE_SIZE)));
  readonly rowOffset = computed(() => {
    if (this.loading() === 'paging') return this.page() * PAGE_SIZE;
    return this.virtual() ? this.vRange().start : 0;
  });
  readonly displayRows = computed(() => {
    const rows = this.rows();
    switch (this.loading()) {
      case 'paging':
        return rows.slice(this.rowOffset(), this.rowOffset() + PAGE_SIZE);
      case 'lazy':
        return rows.slice(0, this.lazyCount());
      case 'virtual':
        return this.virtual() ? rows.slice(this.vRange().start, this.vRange().end) : rows;
      default:
        return rows;
    }
  });
  readonly topSpacer = computed(() => (this.virtual() ? this.vRange().start * this.rowHeight() : 0));
  readonly bottomSpacer = computed(() =>
    this.virtual() ? (this.rows().length - this.vRange().end) * this.rowHeight() : 0,
  );
  readonly shownFrom = computed(() => (this.rows().length ? this.rowOffset() + 1 : 0));
  readonly shownTo = computed(() => this.rowOffset() + this.displayRows().length);

  readonly selectedPayments = computed(() => this.rows().filter((r) => this.selected().has(r.id)));
  readonly allSelected = computed(
    () => this.rows().length > 0 && this.selected().size === this.rows().length,
  );
  readonly someSelected = computed(() => this.selected().size > 0 && !this.allSelected());
  readonly canApproveSelected = computed(() => this.selectedPayments().some(canApprove));
  readonly canStopSelected = computed(() => this.selectedPayments().some(canStop));

  readonly ButtonSize = ButtonSize;
  readonly canApprove = canApprove;
  readonly canStop = canStop;
  readonly canEdit = canEdit;

  constructor() {
    effect(() => {
      this.pinnedCfg();
      untracked(() => this.frozen.set(this.defaultFrozen()));
    });
    effect(() => {
      this.filters();
      this.quick();
      this.search();
      untracked(() => {
        this.selected.set(new Set());
        this.page.set(0);
        this.lazyCount.set(PAGE_SIZE);
      });
    });
    effect(() => {
      this.sortKey();
      this.sortDirection();
      this.loading();
      untracked(() => {
        this.page.set(0);
        this.lazyCount.set(PAGE_SIZE);
        this.vRange.set({ start: 0, end: 40 });
        setTimeout(() => this.updateShadows());
      });
    });
    effect(() => {
      this.lazyCount();
      this.loading();
      untracked(() => setTimeout(() => this.updateShadows()));
    });
    effect(() => {
      this.cfg();
      this.rows();
      this.detailId();
      untracked(() => {
        this.cellSel.set(null);
        setTimeout(() => this.updateShadows());
      });
    });
    effect(() => {
      this.detailMode();
      untracked(() => {
        this.detailId.set(null);
        this.pageDetailId.set(null);
      });
    });
  }

  ngOnInit() {
    this.observer = new ResizeObserver((entries) => {
      this.width.set(entries[0].contentRect.width);
      this.viewportWidth.set(window.innerWidth);
    });
    this.observer.observe(this.host.nativeElement);
  }

  ngOnDestroy() {
    this.observer?.disconnect();
    this.stopCellDrag();
  }

  // Skygger på det, der kan rulle: sticky header og fastlåste kolonner
  readonly stuck = signal(false);
  readonly shadowLeft = signal(false);
  readonly shadowRight = signal(false);

  @HostListener('window:scroll')
  @HostListener('window:resize')
  updateShadows() {
    this.updateVirtual();
    this.checkLazy();
    const el = this.host.nativeElement.querySelector<HTMLElement>('.table-scroll');
    const th = el?.querySelector('thead th');
    const table = el?.querySelector('table');
    if (!el || !th || !table) return;
    this.stuck.set(table.getBoundingClientRect().top < th.getBoundingClientRect().top - 0.5);
    // Når kolonnerne tilpasser sig pladsen, kan tabellen ikke rulle sidelæns, og så skal der ingen skygger være
    const canScroll = !this.fitColumns();
    this.shadowLeft.set(canScroll && el.scrollLeft > 0.5);
    this.shadowRight.set(canScroll && el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    const widths: Record<string, number> = {};
    el.querySelectorAll<HTMLElement>('thead th[data-col]').forEach((t) => {
      widths[t.dataset['col']!] = Math.round(t.getBoundingClientRect().width);
    });
    const actions = el.querySelector<HTMLElement>('thead th.col-actions');
    if (actions) widths['__actions'] = Math.round(actions.getBoundingClientRect().width);
    const old = this.colWidths();
    const keys = Object.keys(widths);
    if (keys.length !== Object.keys(old).length || keys.some((k) => old[k] !== widths[k])) {
      this.colWidths.set(widths);
    }
  }

  // Markering af celler: tryk og hold, og træk (kun når fremhævning er sat til Celle)
  readonly cellSel = signal<{ r1: number; c1: number; r2: number; c2: number } | null>(null);
  private suppressClick = false;
  private pressTimer?: ReturnType<typeof setTimeout>;
  private dragging = false;
  private anchor?: { r: number; c: number };
  private pressPoint?: { x: number; y: number };

  private cellAt(target: EventTarget | null) {
    const td = (target as HTMLElement | null)?.closest?.<HTMLElement>('td[data-c]');
    return td ? { r: Number(td.dataset['r']), c: Number(td.dataset['c']) } : null;
  }

  cellPointerDown(e: PointerEvent) {
    if (this.cfg().highlight !== 'cell' || e.button !== 0) return;
    const cell = this.cellAt(e.target);
    this.cellSel.set(null);
    if (!cell) return;
    this.pressPoint = { x: e.clientX, y: e.clientY };
    this.pressTimer = setTimeout(() => {
      this.dragging = true;
      this.anchor = cell;
      this.cellSel.set({ r1: cell.r, c1: cell.c, r2: cell.r, c2: cell.c });
      window.getSelection()?.removeAllRanges();
    }, 350);
    document.addEventListener('pointermove', this.onCellMove);
    document.addEventListener('pointerup', this.onCellUp);
    document.addEventListener('pointercancel', this.onCellUp);
  }

  private readonly onCellMove = (e: PointerEvent) => {
    if (!this.dragging) {
      // Bevæger musen sig før tiden er gået, er det ikke en markering
      const p = this.pressPoint;
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 6) this.stopCellDrag();
      return;
    }
    const cell = this.cellAt(document.elementFromPoint(e.clientX, e.clientY));
    if (cell && this.anchor) {
      this.cellSel.set({ r1: this.anchor.r, c1: this.anchor.c, r2: cell.r, c2: cell.c });
    }
  };

  private readonly onCellUp = () => {
    if (this.dragging) {
      this.suppressClick = true;
      setTimeout(() => (this.suppressClick = false));
    }
    this.stopCellDrag();
  };

  private stopCellDrag() {
    clearTimeout(this.pressTimer);
    this.dragging = false;
    document.removeEventListener('pointermove', this.onCellMove);
    document.removeEventListener('pointerup', this.onCellUp);
    document.removeEventListener('pointercancel', this.onCellUp);
  }

  cellEdges(r: number, c: number): string | null {
    const s = this.cellSel();
    if (!s) return null;
    const [r1, r2] = [Math.min(s.r1, s.r2), Math.max(s.r1, s.r2)];
    const [c1, c2] = [Math.min(s.c1, s.c2), Math.max(s.c1, s.c2)];
    if (r < r1 || r > r2 || c < c1 || c > c2) return null;
    return ['x', r === r1 ? 't' : '', r === r2 ? 'b' : '', c === c1 ? 'l' : '', c === c2 ? 'r' : ''].join(' ').trim();
  }

  private updateVirtual() {
    if (!this.virtual()) return;
    const tbody = this.host.nativeElement.querySelector<HTMLElement>('tbody');
    if (!tbody) return;
    const h = this.rowHeight();
    const top = tbody.getBoundingClientRect().top;
    const total = this.rows().length;
    const first = Math.max(0, Math.floor(-top / h) - VIRTUAL_BUFFER);
    const last = Math.min(total, Math.ceil((window.innerHeight - top) / h) + VIRTUAL_BUFFER);
    const start = Math.min(first, Math.max(0, total - 20));
    const end = Math.max(last, Math.min(total, start + 20));
    const r = this.vRange();
    if (r.start !== start || r.end !== end) this.vRange.set({ start, end });
  }

  private checkLazy() {
    if (this.loading() !== 'lazy' || this.loadingMore() || this.lazyCount() >= this.rows().length) return;
    const sentinel = this.host.nativeElement.querySelector<HTMLElement>('.lazy-more');
    if (!sentinel || sentinel.getBoundingClientRect().top > window.innerHeight + 200) return;
    this.loadingMore.set(true);
    // Simulerer at næste portion rækker hentes fra serveren
    setTimeout(() => {
      this.lazyCount.update((n) => n + PAGE_SIZE);
      this.loadingMore.set(false);
    }, 700);
  }

  private moveFocus(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    const row = target.closest('tr');
    if (!row || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const cell = target.closest('td');
    let next: HTMLElement | null = null;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const sibling = (e.key === 'ArrowUp' ? row.previousElementSibling : row.nextElementSibling) as HTMLElement | null;
      next = cell && sibling ? (sibling.children[cell.cellIndex] as HTMLElement) : sibling;
    } else if (cell) {
      next = (e.key === 'ArrowLeft' ? cell.previousElementSibling : cell.nextElementSibling) as HTMLElement | null;
    }
    if (!next || next.tabIndex < 0) return;
    e.preventDefault();
    next.focus();
    next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    // Er detaljerne åbne, følger de den række, der får fokus
    if (this.detailId() !== null && this.detailMode() !== 'modal' && this.detailMode() !== 'page') {
      const p = this.rows()[Number(next.closest('tr')!.dataset['index'])];
      if (p) this.detailId.set(p.id);
    }
  }

  cellKeydown(e: KeyboardEvent) {
    this.moveFocus(e);
    const s = this.cellSel();
    if (!s) return;
    if (e.key === 'Escape') {
      this.cellSel.set(null);
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
      const rows = this.rows();
      const cols = this.columns();
      const lines: string[] = [];
      for (let r = Math.min(s.r1, s.r2); r <= Math.max(s.r1, s.r2); r++) {
        const cells: string[] = [];
        for (let c = Math.min(s.c1, s.c2); c <= Math.max(s.c1, s.c2); c++) {
          cells.push(this.plainValue(rows[r], cols[c].key));
        }
        lines.push(cells.join('\t'));
      }
      navigator.clipboard?.writeText(lines.join('\n'));
    }
  }

  sort(key: ColumnKey) {
    if (this.sortKey() === key) {
      this.sortDirection.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortDirection.set('asc');
    }
  }

  isSelected(p: Payment): boolean {
    return this.selected().has(p.id);
  }

  toggleRow(p: Payment, checked: boolean) {
    this.selected.update((s) => {
      const next = new Set(s);
      if (checked) next.add(p.id);
      else next.delete(p.id);
      return next;
    });
  }

  toggleAll(checked: boolean) {
    this.selected.set(checked ? new Set(this.rows().map((r) => r.id)) : new Set());
  }

  approve(p: Payment) {
    this.service.approve(p);
  }

  stop(p: Payment) {
    this.service.stop(p);
  }

  approveIds(ids: number[]) {
    this.service.setStatus(ids, (s) => nextStatusAfterApproval(s));
    this.selected.set(new Set());
  }

  approveSelected() {
    this.service.setStatus(this.selectedPayments().filter(canApprove).map((p) => p.id), (s) =>
      nextStatusAfterApproval(s),
    );
    this.selected.set(new Set());
  }

  stopSelected() {
    this.service.setStatus(this.selectedPayments().filter(canStop).map((p) => p.id), () => 'Stoppet');
    this.selected.set(new Set());
  }

  openDetail(p: Payment, event?: Event) {
    if (this.suppressClick) return;
    const target = event?.target as HTMLElement | null;
    if (target?.closest('kirby-checkbox, button, kirby-menu, kirby-item, a')) return;
    const mode = this.detailMode();
    if (mode === 'none') return;
    if (mode === 'page') {
      this.pageDetailId.set(p.id);
      return;
    }
    this.detailId.set(p.id);
    if (mode === 'modal') {
      this.modalController.showModal(
        {
          component: PaymentDetailComponent,
          flavor: 'modal',
          size: 'medium',
          interactWithBackground: false,
          componentProps: { paymentId: p.id, presentation: 'modal', variant: 'canvas' },
        },
        () => this.detailId.set(null),
      );
    }
  }

    closeDetail() {
    this.detailId.set(null);
    this.pageDetailId.set(null);
  }

  readonly formatDate = formatDate;
  readonly formatAmount = formatAmount;

  statusAsFlag(status: PaymentStatus): boolean {
    return this.cfg().statusStyle === 'flag' && STATUS_NEEDS_ATTENTION.has(status);
  }

  statusColor(status: PaymentStatus): FlagColor {
    return STATUS_COLORS[status];
  }

  isColumnShown(key: ColumnKey): boolean {
    return this.cfg().visibleColumns.includes(key);
  }

  toggleColumn(key: ColumnKey, shown: boolean) {
    this.configService.toggleColumn(key, shown);
  }

  plainValue(p: Payment, key: ColumnKey): string {
    return String(p[key as keyof Payment] ?? '');
  }
}
