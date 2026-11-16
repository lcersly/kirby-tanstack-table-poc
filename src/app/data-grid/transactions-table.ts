import { SfIconComponent } from './sf-icon';
import { Component, ElementRef, HostListener, OnDestroy, OnInit, AfterViewChecked, computed, effect, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { BadgeComponent } from '@kirbydesign/designsystem/badge';
import { ButtonComponent } from '@kirbydesign/designsystem/button';
import { SegmentItem, SegmentedControlComponent } from '@kirbydesign/designsystem/segmented-control';
import { CardComponent } from '@kirbydesign/designsystem/card';
import { CheckboxComponent } from '@kirbydesign/designsystem/checkbox';
import { FlagComponent } from '@kirbydesign/designsystem/flag';
import { IconComponent } from '@kirbydesign/designsystem/icon';
import { AffixDirective, FormFieldComponent, InputComponent } from '@kirbydesign/designsystem/form-field';
import { ColumnMenuComponent } from './column-menu';
import { CurrencyComponent } from './currency';
import {
  ColumnFilter,
  DateFilter,
  MOCK_TODAY,
  NumberFilter,
  dateFilterActive,
  dateFilterLabel,
  dateMatches,
  numberFilterActive,
  numberFilterLabel,
  numberMatches,
} from './payments-table';
import { RecipientCheckComponent } from './recipient-check';
import { SfArrowComponent } from './sf-arrow';
import { UserViewMenuComponent } from './user-view-menu';
import { formatAmount, formatDate } from './payments';
import { TableConfigService } from './table-config';
import { TransactionsSummaryComponent } from './transactions-summary';
import { TransactionDetailComponent } from './transaction-detail';
import { TRANSACTION_STATUS_COLORS, Transaction, TransactionStatus, TransactionsService } from './transactions';

type TransactionKey =
  | 'date'
  | 'valueDate'
  | 'text'
  | 'amount'
  | 'currency'
  | 'balance'
  | 'reference'
  | 'status'
  | 'recipientCheck'
  | 'attachments';

interface TransactionColumn {
  key: TransactionKey;
  label: string;
  align?: 'right';
  /** Lavere tal = vigtigere. Bruges, når kolonner skjules ved pladsmangel. */
  priority: number;
  /** Cirka bredde i px. Bruges, når kolonner skjules ved pladsmangel. */
  width: number;
  noHide?: boolean;
  hideLabel?: boolean;
  nowrap?: boolean;
  kind?: 'text' | 'number' | 'date';
  filter?: 'values' | 'number' | 'text' | 'date';
  plural: string;
}

// Rækkefølgen er den, brugeren har bedt om. Dato, posteringstekst og beløb skjules aldrig.
const COLUMNS: TransactionColumn[] = [
  { key: 'date', label: 'Dato', priority: 1, width: 110, noHide: true, nowrap: true, kind: 'date', filter: 'date', plural: 'datoer' },
  { key: 'valueDate', label: 'Valørdato', priority: 7, width: 110, nowrap: true, kind: 'date', filter: 'date', plural: 'valørdatoer' },
  { key: 'text', label: 'Posteringstekst', priority: 0, width: 240, noHide: true, filter: 'text', plural: 'posteringstekster' },
  { key: 'amount', label: 'Beløb', align: 'right', priority: 2, width: 130, noHide: true, nowrap: true, kind: 'number', filter: 'number', plural: 'beløb' },
  { key: 'currency', label: 'Valuta', priority: 9, width: 80, nowrap: true, filter: 'values', plural: 'valutaer' },
  { key: 'balance', label: 'Saldo', align: 'right', priority: 5, width: 140, nowrap: true, kind: 'number', filter: 'number', plural: 'saldi' },
  { key: 'reference', label: 'Bilagsreference', priority: 8, width: 150, filter: 'text', plural: 'bilagsreferencer' },
  { key: 'status', label: 'Status', priority: 3, width: 120, nowrap: true, filter: 'values', plural: 'statusser' },
  { key: 'recipientCheck', label: 'Modtagertjek', priority: 6, width: 170, nowrap: true, filter: 'values', plural: 'modtagertjek' },
  { key: 'attachments', label: 'Bilag', priority: 4, width: 56, nowrap: true, hideLabel: true, plural: 'bilag' },
];

const SMALL_SCREEN_MAX = 768;
const SELECT_WIDTH = 56;
const INLINE_PANEL_WIDTH = 400;

const PERIODS = [
  { label: 'Sidste 7 dage', days: 7 },
  { label: 'Sidste 30 dage', days: 30 },
  { label: 'Sidste 90 dage', days: 90 },
  { label: 'Sidste 365 dage', days: 365 },
];

function isoDaysBefore(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
const FIT_MARGIN = 32;

/** Kontobevægelser på den valgte konto. Bruger samme udseende og konfiguration som betalingstabellen. */
@Component({
  selector: 'app-transactions-table',
  imports: [
    SfIconComponent,
    AffixDirective,
    BadgeComponent,
    ButtonComponent,
    ColumnMenuComponent,
    SegmentedControlComponent,
    TransactionsSummaryComponent,
    TransactionDetailComponent,
    FormFieldComponent,
    InputComponent,
    NgTemplateOutlet,
    CardComponent,
    CheckboxComponent,
    FlagComponent,
    IconComponent,
    CurrencyComponent,
    RecipientCheckComponent,
    SfArrowComponent,
    UserViewMenuComponent,
  ],
  host: {
    '[class.on-plain]': "cfg().container === 'canvas'",
    '[class.on-card]': "cfg().container === 'card'",
    '[class.on-stroked]': "cfg().container === 'stroked-card'",
    '[class.on-canvas]': "cfg().container !== 'card'",
  },
  templateUrl: './transactions-table.html',
  styleUrl: './payments-table.scss',
})
export class TransactionsTableComponent implements OnInit, OnDestroy, AfterViewChecked {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly service = inject(TransactionsService);
  readonly cfg = inject(TableConfigService).effective;

  readonly search = signal('');
  readonly filters = signal<Partial<Record<TransactionKey, ColumnFilter>>>({});
  readonly periodItems: SegmentItem[] = PERIODS.map((p) => ({ id: String(p.days), text: p.label }));
  readonly periodIndex = signal(1);
  readonly sortKey = signal<TransactionKey>('date');
  readonly sortDirection = signal<'asc' | 'desc'>('desc');
  readonly selected = signal<ReadonlySet<number>>(new Set());
  readonly stuck = signal(false);
  private readonly width = signal(1200);
  private readonly viewportWidth = signal(window.innerWidth);
  private observer?: ResizeObserver;
  private innerScroll: Element | null = null;

  readonly formatDate = formatDate;
  readonly formatAmount = formatAmount;

  readonly detailId = signal<number | null>(null);
  readonly detailRow = computed(() => this.rows().find((t) => t.id === this.detailId()) ?? null);
  readonly showSummary = computed(() => this.selectedRows().length >= 2 || (this.selectedRows().length === 1 && !this.detailRow()));
  /** Summeringspanelet kan skjules til en lille snip, uden at rækkernes markering fjernes */
  readonly panelCollapsed = signal(false);
  private readonly resetCollapse = effect(() => {
    if (!this.showSummary() || !this.hasPanelContent()) this.panelCollapsed.set(false);
  });
  readonly hasPanelContent = computed(() => (this.selectedRows().length >= 1 || !!this.detailRow()) && !this.showCards());
  readonly bulkOpen = computed(() => this.hasPanelContent() && !(this.showSummary() && this.panelCollapsed()));
  /** Pladsen, tabellen regner med til panelet. */
  readonly layoutPanel = signal(0);
  private readonly syncLayoutPanel = effect(() => {
    const w = this.bulkOpen() ? INLINE_PANEL_WIDTH : 0;
    this.layoutPanel.set(w);
  });
  readonly fitColumns = computed(() => this.cfg().columnOverflow === 'hide' || this.layoutPanel() > 0);
  readonly showCards = computed(() => this.cfg().cardsOnSmallScreens && this.viewportWidth() < SMALL_SCREEN_MAX);
  readonly flagSize = computed(() => ({ compact: 'xs', standard: 'sm', spacious: 'md' } as const)[this.cfg().density]);
  readonly checkboxSize = computed(() => (this.cfg().density === 'spacious' ? 'md' : this.cfg().checkboxSize));
  readonly checkAvatarSize = computed(() => ({ compact: 'xxs', standard: 'sm', spacious: 'md' } as const)[this.cfg().density]);
  readonly avatarSize = computed(() => (this.cfg().density === 'compact' ? 'xxs' : 'xs'));

  readonly columns = computed<TransactionColumn[]>(() => {
    if (!this.fitColumns()) return COLUMNS;
    let available = this.width() - this.layoutPanel() - (this.cfg().featureSelect ? SELECT_WIDTH : 0) - FIT_MARGIN;
    const keep = new Set<TransactionKey>();
    for (const c of COLUMNS.filter((c) => c.noHide)) {
      keep.add(c.key);
      available -= c.width;
    }
    for (const c of [...COLUMNS].sort((a, b) => a.priority - b.priority)) {
      if (keep.has(c.key)) continue;
      if (c.width > available) break;
      keep.add(c.key);
      available -= c.width;
    }
    return COLUMNS.filter((c) => keep.has(c.key));
  });

  // Perioden gælder også afventende posteringer, som ligger frem i tiden
  private readonly periodRows = computed(() => {
    const from = isoDaysBefore(MOCK_TODAY, PERIODS[this.periodIndex()].days);
    return this.service.transactions().filter((t) => t.date >= from);
  });

  private matches(t: Transaction, filters: Partial<Record<TransactionKey, ColumnFilter>>, except?: TransactionKey): boolean {
    for (const col of COLUMNS) {
      const f = filters[col.key];
      if (!f || col.key === except) continue;
      const value = this.plainValue(t, col.key);
      if (f.text && !value.toLowerCase().includes(f.text.toLowerCase())) return false;
      if (f.values && !f.values.includes(value)) return false;
      const raw = t[col.key as keyof Transaction];
      if (numberFilterActive(f.num) && typeof raw === 'number' && !numberMatches(raw, f.num)) return false;
      if (dateFilterActive(f.date) && typeof raw === 'string' && !dateMatches(raw, f.date)) return false;
    }
    return true;
  }

  readonly valueOptions = computed(() => {
    const filters = this.filters();
    const result = {} as Record<TransactionKey, { value: string; count: number }[]>;
    for (const col of COLUMNS) {
      const counts = new Map<string, number>();
      if (col.filter === 'number' || col.filter === 'date') {
        result[col.key] = [];
        continue;
      }
      for (const t of this.periodRows()) {
        if (!this.matches(t, filters, col.key)) continue;
        const v = this.plainValue(t, col.key);
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      result[col.key] = [...counts]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => a.value.localeCompare(b.value, 'da', { numeric: true }));
    }
    return result;
  });

  readonly activeFilters = computed(() =>
    COLUMNS.flatMap((col) => {
      const f = this.filters()[col.key];
      if (!f) return [];
      if (numberFilterActive(f.num)) return [{ key: col.key, count: 1, label: `${col.label}: ${numberFilterLabel(f.num)}` }];
      if (dateFilterActive(f.date)) return [{ key: col.key, count: 1, label: `${col.label}: ${dateFilterLabel(f.date)}` }];
      const parts = [...(f.text ? [`"${f.text}"`] : []), ...(f.values ?? [])];
      if (f.values && !f.values.length) return [{ key: col.key, count: 1, label: `${col.label}: ingen valgt` }];
      if (!parts.length) return [];
      return [{ key: col.key, count: parts.length, label: parts.length === 1 ? `${col.label}: ${parts[0] || '(tom)'}` : col.label }];
    }),
  );

  private setFilter(key: TransactionKey, patch: Partial<ColumnFilter>) {
    this.filters.update((all) => {
      const f: ColumnFilter = { text: '', values: null, ...all[key], ...patch };
      const next = { ...all, [key]: f };
      if (!f.text && !f.values && !numberFilterActive(f.num) && !dateFilterActive(f.date)) delete next[key];
      return next;
    });
  }
  setTextFilter(key: TransactionKey, text: string) {
    this.setFilter(key, { text });
  }
  setValueFilter(key: TransactionKey, values: string[] | null) {
    this.setFilter(key, { values });
  }
  setNumberFilter(key: TransactionKey, num: NumberFilter | null) {
    this.setFilter(key, { num });
  }
  setDateFilter(key: TransactionKey, date: DateFilter | null) {
    this.setFilter(key, { date });
  }
  clearFilter(key: TransactionKey) {
    this.filters.update((f) => {
      const rest = { ...f };
      delete rest[key];
      return rest;
    });
  }
  clearAllFilters() {
    this.filters.set({});
  }
  readonly hasFilters = computed(() => this.activeFilters().length > 0);

  private searchText(t: Transaction) {
    return [
      formatDate(t.date),
      t.date,
      formatDate(t.valueDate),
      t.valueDate,
      t.text,
      formatAmount(t.amount),
      t.currency,
      formatAmount(t.balance),
      t.reference,
      t.status,
      t.recipientCheck ?? '',
      t.hasAttachment ? 'bilag vedhæftning' : '',
    ]
      .join(' ')
      .toLowerCase();
  }

  readonly rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    const filters = this.filters();
    const list = this.periodRows().filter(
      (t) =>
        this.matches(t, filters) &&
        (!q || this.searchText(t).includes(q)),
    );
    const key = this.sortKey();
    const dir = this.sortDirection() === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const x = this.sortValue(a, key);
      const y = this.sortValue(b, key);
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'da')) * dir;
    });
  });
  readonly viewRows = this.rows;

  readonly selectedRows = computed(() => this.rows().filter((t) => this.selected().has(t.id)));
  readonly allSelected = computed(() => this.rows().length > 0 && this.rows().every((t) => this.selected().has(t.id)));
  readonly someSelected = computed(() => !this.allSelected() && this.rows().some((t) => this.selected().has(t.id)));

  private sortValue(t: Transaction, key: TransactionKey): string | number {
    switch (key) {
      case 'amount':
      case 'balance':
        return t[key];
      case 'attachments':
        return t.hasAttachment ? 1 : 0;
      case 'recipientCheck':
        return t.recipientCheck ?? '';
      default:
        return t[key];
    }
  }

  defaultDirection(col: Pick<TransactionColumn, 'kind'>): 'asc' | 'desc' {
    return col.kind === 'date' ? 'desc' : 'asc';
  }

  sort(key: TransactionKey) {
    if (this.sortKey() === key) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDirection.set(this.defaultDirection(COLUMNS.find((c) => c.key === key)!));
    }
  }

  sortBy(key: TransactionKey, direction: 'asc' | 'desc') {
    this.sortKey.set(key);
    this.sortDirection.set(direction);
  }

  isSelected(t: Transaction) {
    return this.selected().has(t.id);
  }

  toggleRow(t: Transaction, checked: boolean) {
    const next = new Set(this.selected());
    if (checked) next.add(t.id);
    else next.delete(t.id);
    this.selected.set(next);
    if (checked) this.detailId.set(null);
  }

  openDetail(t: Transaction, event?: Event) {
    const target = event?.target as HTMLElement | null;
    if (target?.closest('kirby-checkbox, button, kirby-menu, kirby-item, a')) return;
    this.detailId.set(t.id);
  }

  toggleAll(checked: boolean) {
    this.selected.set(checked ? new Set(this.rows().map((t) => t.id)) : new Set());
  }

  statusAsFlag(status: TransactionStatus): boolean {
    return this.cfg().statusStyle === 'flag' && status === 'Afventer';
  }

  statusAsOutline(status: TransactionStatus): boolean {
    return this.cfg().statusStyle === 'flag' && this.cfg().noActionStatusStyle === 'outline' && status !== 'Afventer';
  }

  statusColor(status: TransactionStatus) {
    return TRANSACTION_STATUS_COLORS[status];
  }

  plainValue(t: Transaction, key: TransactionKey): string {
    if (key === 'date' || key === 'valueDate') return formatDate(t[key]);
    if (key === 'attachments') return t.hasAttachment ? 'Ja' : 'Nej';
    return String(t[key as keyof Transaction] ?? '');
  }

  // Kolonneoverskrifterne hæfter sig lige under værktøjslinjen, så dens højde skal kendes
  ngAfterViewChecked() {
    const el = this.host.nativeElement;
    const h = el.querySelector<HTMLElement>('.toolbar')?.getBoundingClientRect().height ?? 0;
    const pad = this.innerScroll ? parseFloat(getComputedStyle(this.innerScroll).paddingTop) || 0 : 0;
    if (el.style.getPropertyValue('--sticky-top') !== `${-pad}px`) el.style.setProperty('--sticky-top', `${-pad}px`);
    const visible = `${this.innerScroll?.clientHeight || window.innerHeight}px`;
    if (el.style.getPropertyValue('--scroll-h') !== visible) el.style.setProperty('--scroll-h', visible);
    if (el.style.getPropertyValue('--toolbar-h') !== `${h}px`) el.style.setProperty('--toolbar-h', `${h}px`);
  }

  private readonly onScroll = () => this.updateStuck();

  ngOnInit() {
    document.addEventListener('scroll', this.onScroll, { capture: true, passive: true });
    // Kirbys side ruller inde i en skjult del af ion-content, hvor scroll-hændelser ikke kommer ud
    setTimeout(() => {
      this.innerScroll = this.host.nativeElement.closest('ion-content')?.shadowRoot?.querySelector('.inner-scroll') ?? null;
      this.innerScroll?.addEventListener('scroll', this.onScroll, { passive: true });
      this.ngAfterViewChecked();
    });
    this.observer = new ResizeObserver((entries) => {
      this.width.set(entries[0].contentRect.width);
      this.viewportWidth.set(window.innerWidth);
    });
    this.observer.observe(this.host.nativeElement);
  }

  ngOnDestroy() {
    document.removeEventListener('scroll', this.onScroll, true);
    this.innerScroll?.removeEventListener('scroll', this.onScroll);
    this.observer?.disconnect();
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  updateStuck() {
    const el = this.host.nativeElement.querySelector<HTMLElement>('.table-scroll');
    const th = el?.querySelector('thead th');
    const table = el?.querySelector('table');
    if (!el || !th || !table) return;
    this.stuck.set(table.getBoundingClientRect().top < th.getBoundingClientRect().top - 0.5);
  }
}
