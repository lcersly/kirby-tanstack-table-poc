import { SfIconComponent } from './sf-icon';
import {
  AfterViewChecked,
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
import { DropdownComponent } from '@kirbydesign/designsystem/dropdown';
import { SaveFilterDialogComponent } from './save-filter-dialog';
import { BadgeComponent } from '@kirbydesign/designsystem/badge';
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
import { SegmentItem, SegmentedControlComponent } from '@kirbydesign/designsystem/segmented-control';
import { SpinnerComponent } from '@kirbydesign/designsystem/spinner';
import { AffixDirective, FormFieldComponent, InputComponent } from '@kirbydesign/designsystem/form-field';
import { UserViewMenuComponent } from './user-view-menu';
import { ColumnMenuComponent } from './column-menu';
import { SfArrowComponent } from './sf-arrow';
import { ToBodyDirective } from './to-body';
import { PaymentDetailComponent } from './payment-detail';
import { PaymentsService } from './payments.service';
import { COLUMNS, ColumnDef, ColumnKey, TableConfigService, defaultDirection } from './table-config';

const SMALL_SCREEN_MAX = 768;
const SELECT_WIDTH = 56;
// [OPEN POINT: "I dag" er fast i prototypen, så der er både kommende og tidligere betalinger]
export const MOCK_TODAY = '2026-10-14';
export const QUICK_FILTERS = [
  { id: 'upcoming', label: 'Kommende', test: (p: Payment) => p.date > MOCK_TODAY },
  { id: 'missing', label: 'Mangler godkendelse', test: (p: Payment) => p.status.startsWith('Mangler') },
  { id: 'rejected', label: 'Afviste', test: (p: Payment) => p.status === 'Afvist' },
  { id: 'error', label: 'Fejl', test: (p: Payment) => p.status === 'Fejl' },
] as const;
// Margen, så kolonnernes faktiske indhold (fx kolonnemenuen) ikke giver sidelæns rulning
const FIT_MARGIN = 32;

export interface SavedFilter {
  id: number;
  name: string;
  filters: Partial<Record<ColumnKey, ColumnFilter>>;
  sortKey: ColumnKey;
  sortDirection: 'asc' | 'desc';
}

export type NumberOp = 'gt' | 'lt' | 'between' | 'eq' | 'neq';

export interface NumberFilter {
  op: NumberOp;
  a: number | null;
  b: number | null;
}

export type DatePreset = 'upcoming' | '7' | '30' | '365' | 'custom';

export interface DateFilter {
  preset: DatePreset;
  /** Kun for selvvalgt periode: ISO-datoer (åååå-mm-dd) */
  from: string | null;
  to: string | null;
}

export interface ColumnFilter {
  text: string;
  values: string[] | null;
  num?: NumberFilter | null;
  date?: DateFilter | null;
}

export const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: 'upcoming', label: 'Kommende' },
  { id: '7', label: 'Sidste 7 dage' },
  { id: '30', label: 'Sidste 30 dage' },
  { id: '365', label: 'Sidste 365 dage' },
  { id: 'custom', label: 'Selvvalgt periode' },
];

/** Et selvvalgt datointerval gælder først, når mindst én dato er valgt */
export function dateFilterActive(d: DateFilter | null | undefined): d is DateFilter {
  return !!d && (d.preset !== 'custom' || !!d.from || !!d.to);
}

function isoDaysBefore(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function dateMatches(iso: string, d: DateFilter): boolean {
  if (d.preset === 'upcoming') return iso > MOCK_TODAY;
  if (d.preset === 'custom') return (!d.from || iso >= d.from) && (!d.to || iso <= d.to);
  return iso <= MOCK_TODAY && iso >= isoDaysBefore(MOCK_TODAY, Number(d.preset));
}

export function dateFilterLabel(d: DateFilter): string {
  if (d.preset !== 'custom') return DATE_PRESETS.find((p) => p.id === d.preset)!.label;
  const f = (iso: string) => iso.split('-').reverse().join('.');
  if (d.from && d.to) return `${f(d.from)} – ${f(d.to)}`;
  return d.from ? `Fra ${f(d.from)}` : `Til ${f(d.to!)}`;
}

/** Et talfilter gælder først, når alle de tal, det kræver, er udfyldt */
export function numberFilterActive(n: NumberFilter | null | undefined): n is NumberFilter {
  return !!n && n.a !== null && (n.op !== 'between' || n.b !== null);
}

export function numberFilterLabel(n: NumberFilter): string {
  const f = (v: number | null) => (v ?? 0).toLocaleString('da-DK');
  switch (n.op) {
    case 'gt':
      return `Højere end ${f(n.a)}`;
    case 'lt':
      return `Lavere end ${f(n.a)}`;
    case 'eq':
      return `Lig med ${f(n.a)}`;
    case 'neq':
      return `Forskellig fra ${f(n.a)}`;
    case 'between':
      return `Mellem ${f(n.a)} og ${f(n.b)}`;
  }
}

function numberMatches(v: number, n: NumberFilter): boolean {
  const a = n.a as number;
  switch (n.op) {
    case 'gt':
      return v > a;
    case 'lt':
      return v < a;
    case 'eq':
      return v === a;
    case 'neq':
      return v !== a;
    case 'between': {
      const b = n.b as number;
      return v >= Math.min(a, b) && v <= Math.max(a, b);
    }
  }
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
    SfIconComponent,
    AffixDirective,
    FormFieldComponent,
    InputComponent,
    ColumnMenuComponent,
    SfArrowComponent,
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
    BadgeComponent,
    DropdownComponent,
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
export class PaymentsTableComponent implements OnInit, OnDestroy, AfterViewChecked {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly configService = inject(TableConfigService);
  readonly cfg = this.configService.effective;
  readonly allColumns = COLUMNS;
  readonly defaultDirection = defaultDirection;

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
  readonly flagSize = computed(() => ({ compact: 'xs', standard: 'sm', spacious: 'md' } as const)[this.cfg().density]);

  private effWidth(c: ColumnDef): number {
    // Kolonner med menu kan ikke blive smallere end deres indhold, så det bruges som gulv, når pladsen regnes ud
    const floor = this.hasColumnMenu() ? (c.key === 'attachments' ? 90 : 128) : 0;
    return Math.max(this.widthOf(c) ?? c.width, floor);
  }

  /** Kolonnen, brugeren sidst trykkede i. Den skjules så sent som muligt, når detaljerne tager plads */
  readonly focusCol = signal<ColumnKey | null>(null);

  readonly columns = computed<ColumnDef[]>(() => {
    const order = this.cfg().visibleColumns;
    const chosen = COLUMNS.filter((c) => c.noHide || order.includes(c.key)).sort(
      (a, b) => order.indexOf(a.key) - order.indexOf(b.key),
    );
    // Inline-panelet skubber tabellen og skjuler de mindst vigtige kolonner
    const hide = this.cfg().columnOverflow === 'hide' || this.inlineOpen();
    if (!hide) return chosen;
    const fixed = this.selectWidth() + Math.max(this.actionsWidth(), 64) + FIT_MARGIN;
    let available = this.width() - (this.inlineOpen() ? INLINE_PANEL_WIDTH : 0) - fixed;
    const keep = new Set<ColumnKey>();
    for (const c of chosen.filter((c) => c.noHide)) {
      keep.add(c.key);
      available -= this.effWidth(c);
    }
    // Prioritet: Dato, de to sidste kolonner (bilag og beløb), den kolonne brugeren trykkede i, fastgjorte kolonner,
    // derefter fra venstre mod højre. Markering og handlinger er faste og trækkes allerede fra pladsen.
    const frozen = this.frozen();
    const head = [
      chosen[0],
      ...chosen.slice(-2).reverse(),
      chosen.find((c) => c.key === this.focusCol()),
      ...chosen.filter((c) => frozen[c.key]),
    ].filter((c): c is ColumnDef => !!c);
    const ranked = [...new Set([...head, ...chosen])];
    for (const c of ranked) {
      if (keep.has(c.key)) continue;
      if (this.effWidth(c) > available) break;
      keep.add(c.key);
      available -= this.effWidth(c);
    }
    return chosen.filter((c) => keep.has(c.key));
  });

  readonly showCards = computed(
    () => this.cfg().cardsOnSmallScreens && this.viewportWidth() < SMALL_SCREEN_MAX,
  );

  readonly actionsDisplay = computed<'full' | 'label' | 'icon' | 'menu'>(() => {
    if (this.cfg().actionsOverflow) return 'menu';
    const forced = this.cfg().actionsForce;
    if (forced !== 'auto') return forced;
    const available = this.width() - (this.inlineOpen() ? INLINE_PANEL_WIDTH : 0);
    return ACTION_STEPS.find((s) => available >= s.minTable)?.display ?? 'menu';
  });

  private readonly actionsWidth = computed(() => {
    if (this.pageMode()) return DISCLOSURE_WIDTH;
    if (!this.cfg().featureRowActions) return 0;
    return ACTION_STEPS.find((s) => s.display === this.actionsDisplay())?.width ?? DISCLOSURE_WIDTH;
  });

  readonly selectWidth = computed(() => (this.cfg().featureSelect ? SELECT_WIDTH : 0));
  /** Kolonnen med rækkehandlinger vises, når der er handlinger, eller når rækken fører til en detaljeside */
  readonly showActionsColumn = computed(() => this.cfg().featureRowActions || this.pageMode());
  readonly canFreeze = computed(() => this.cfg().columnOverflow === 'scroll');
  readonly hasColumnMenu = computed(() => {
    const c = this.cfg();
    return c.featureSort || c.featureFilter || this.canFreeze() || c.userColumnWidth || c.userColumnChoice;
  });
  readonly showToolbar = computed(() => {
    const c = this.cfg();
    return c.featureQuick || c.featureSearch || c.featureSettings || c.featureShare || this.activeFilters().length > 0 || this.savedFilters().length > 0;
  });

  readonly checkboxSize = computed(() => (this.cfg().density === 'spacious' ? 'md' : this.cfg().checkboxSize));
  readonly checkAvatarSize = computed(() => ({ compact: 'xxs', standard: 'sm', spacious: 'md' } as const)[this.cfg().density]);
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
      const raw = p[col.key as keyof Payment];
      if (numberFilterActive(f.num) && typeof raw === 'number' && !numberMatches(raw, f.num)) return false;
      if (dateFilterActive(f.date) && typeof raw === 'string' && !dateMatches(raw, f.date)) return false;
    }
    return true;
  }

  /** Værdier og antal pr. kolonne. Tager højde for filtrene på de øvrige kolonner */
  readonly valueOptions = computed(() => {
    const filters = this.filters();
    const result = {} as Record<ColumnKey, { value: string; count: number }[]>;
    for (const col of COLUMNS) {
      const counts = new Map<string, number>();
      // Tal varierer for meget til at kunne vælges enkeltvis
      if (col.filter === 'number' || col.filter === 'date') {
        result[col.key] = [];
        continue;
      }
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

  /** Ved rulning ligger Dato og de to sidste kolonner fast sammen med markering og handlinger, plus fastgjorte kolonner */
  private readonly effFrozen = computed(() => {
    const cols = this.columns();
    const pin = this.pinnedCfg();
    const implicit: Partial<Record<ColumnKey, 'left' | 'right'>> = {};
    // Når kolonnerne tilpasser sig pladsen, er der ingen sidelæns rulning og dermed intet at fastlåse
    if (this.fitColumns()) return implicit;
    if (pin !== 'none' && cols.length) implicit[cols[0].key] = 'left';
    if (pin === 'both' && cols.length > 2) cols.slice(-2).forEach((c) => (implicit[c.key] = 'right'));
    return { ...implicit, ...this.frozen() };
  });
  readonly pinLeft = computed(() => !this.fitColumns() && (this.pinnedCfg() !== 'none' || Object.values(this.frozen()).includes('left')));
  readonly pinRight = computed(
    () => !this.fitColumns() && (this.pinnedCfg() === 'both' || Object.values(this.frozen()).includes('right')),
  );

  /** Sticky-placering for fastlåste kolonner, ud fra de målte kolonnebredder */
  readonly frozenInfo = computed(() => {
    const f = this.effFrozen();
    const w = this.colWidths();
    const cols = this.columns();
    const info: Partial<Record<ColumnKey, { side: 'left' | 'right'; offset: number; edge: boolean }>> = {};
    let left = this.selectWidth();
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

  // Tal i badges følger kun søgning og kolonnefiltre, ikke de hurtige filtre selv
  private readonly quickBase = computed(() => {
    const filters = this.filters();
    const term = this.search().trim().toLowerCase();
    return this.payments().filter((p) => this.matches(p, filters) && (!term || COLUMNS.some((c) => this.plainValue(p, c.key).toLowerCase().includes(term))));
  });
  readonly quickItems = computed<SegmentItem[]>(() => {
    const base = this.quickBase();
    const item = (id: string, text: string, count: number, themeColor: 'medium' | 'warning'): SegmentItem => ({
      id,
      text,
      badge: { content: String(count), themeColor, description: `${count} betalinger` },
    });
    return [
      ...QUICK_FILTERS.map((q) =>
        item(q.id, q.label, base.filter((p) => q.test(p)).length, q.id === 'rejected' || q.id === 'error' ? 'warning' : 'medium'),
      ),
      item('all', 'Alle', base.length, 'medium'),
    ];
  });
  readonly quickIndex = computed(() => {
    if (this.activeSavedId() !== null) return -1;
    const id = [...this.quick()][0];
    return this.quickItems().findIndex((q) => q.id === (id ?? 'all'));
  });

  setQuick(index: number) {
    this.snapshotRows();
    const id = this.quickItems()[index]?.id;
    this.quick.set(!id || id === 'all' ? new Set() : new Set([id]));
    // Et hurtigfilter afløser de kolonnefiltre, der er sat
    if (id && id !== 'all') this.filters.set({});
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

  // Måler det bredeste indhold i de indlæste rækker (og overskriften) og sætter bredden efter det
  private contentWidth(key: ColumnKey): number | null {
    const root = this.host.nativeElement;
    const th = root.querySelector<HTMLElement>(`thead th[data-col="${key}"]`);
    if (!th) return null;
    const pad = (el: HTMLElement) => {
      const cs = getComputedStyle(el);
      return parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    };
    const inner = th.querySelector<HTMLElement>('.th-inner');
    let widest = 0;
    if (inner) {
      const gap = parseFloat(getComputedStyle(inner).columnGap) || 0;
      const parts = Array.from(inner.children) as HTMLElement[];
      widest = parts.reduce((sum, el) => sum + (el.scrollWidth || el.offsetWidth), 0) + gap * (parts.length - 1);
    }
    widest += pad(th);
    root.querySelectorAll<HTMLElement>(`tbody td[data-col="${key}"]`).forEach((td) => {
      const text = td.querySelector<HTMLElement>('.cell-text');
      let w: number;
      if (text) w = text.scrollWidth;
      else {
        const range = document.createRange();
        range.selectNodeContents(td);
        w = range.getBoundingClientRect().width;
      }
      widest = Math.max(widest, Math.ceil(w) + pad(td));
    });
    return Math.min(600, Math.ceil(widest));
  }

  autoFit(col: ColumnDef) {
    const w = this.contentWidth(col.key);
    if (w) this.configService.setUserWidth(col.key, w);
    setTimeout(() => this.updateShadows());
  }

  autoFitAll() {
    // Mål først, så ændringer undervejs ikke påvirker målingen
    const widths = this.columns().map((c) => [c.key, this.contentWidth(c.key)] as const);
    for (const [key, w] of widths) if (w) this.configService.setUserWidth(key, w);
    setTimeout(() => this.updateShadows());
  }

  resetWidth(col: ColumnDef, e: Event) {
    e.stopPropagation();
    this.configService.setUserWidth(col.key, null);
  }

  setTextFilter(key: ColumnKey, text: string) {
    this.snapshotRows();
    this.filters.update((f) => this.withFilter(f, key, { ...f[key], text, values: f[key]?.values ?? null }));
  }

  setNumberFilter(key: ColumnKey, num: NumberFilter | null) {
    this.snapshotRows();
    this.filters.update((f) => this.withFilter(f, key, { text: '', values: null, ...f[key], num }));
  }

  setDateFilter(key: ColumnKey, date: DateFilter | null) {
    this.snapshotRows();
    this.filters.update((f) => this.withFilter(f, key, { text: '', values: null, ...f[key], date }));
  }

  // Ét valg pr. kolonne: antal valgte filtre og en tekst til chippen
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

  // Gemte filtre: kolonnefiltre og sortering, der vises som chips ved hurtigfiltrene
  readonly savedFilters = signal<SavedFilter[]>([]);
  private nextSavedId = 1;

  readonly activeSavedId = computed(() => {
    const filters = JSON.stringify(this.filters());
    return (
      this.savedFilters().find(
        (s) => JSON.stringify(s.filters) === filters && s.sortKey === this.sortKey() && s.sortDirection === this.sortDirection(),
      )?.id ?? null
    );
  });
  readonly canSaveFilter = computed(() => this.columnFiltered() && this.activeSavedId() === null);

  // Antal gemte filtre, der er plads til ved siden af hurtigfiltrene. Resten samles i en dropdown
  private readonly visibleSavedCount = computed(() => {
    const saved = this.savedFilters();
    if (saved.length === 1) return 1;
    let budget = this.width() - (this.inlineOpen() ? INLINE_PANEL_WIDTH : 0) - 32 - 380 - 620;
    let count = 0;
    for (const s of saved) {
      const w = 40 + s.name.length * 8 + 8;
      const reserve = count < saved.length - 1 ? 150 : 0;
      if (budget - w < reserve && count < saved.length - 1) break;
      if (budget - w < 0) break;
      budget -= w;
      count++;
    }
    return count;
  });
  readonly visibleSaved = computed(() => this.savedFilters().slice(0, this.visibleSavedCount()));
  readonly overflowSaved = computed(() => this.savedFilters().slice(this.visibleSavedCount()));
  readonly overflowNames = computed(() => this.overflowSaved().map((s) => s.name));
  readonly overflowIndex = computed(() => this.overflowSaved().findIndex((s) => s.id === this.activeSavedId()));

  applySaved(saved: SavedFilter | undefined) {
    if (!saved || saved.id === this.activeSavedId()) return;
    this.snapshotRows();
    this.quick.set(new Set());
    this.filters.set(structuredClone(saved.filters));
    this.sortKey.set(saved.sortKey);
    this.sortDirection.set(saved.sortDirection);
  }

  // Enkelt værdi: værdien. Flere værdier i én kolonne: antal + kolonnenavn i flertal. Flere kolonner: første kolonne + antal øvrige
  private suggestFilterName(): string {
    const cols = COLUMNS.filter((c) => this.activeFilters().some((f) => f.key === c.key));
    if (cols.length > 1) return `${cols[0].label} + ${cols.length - 1}`;
    const col = cols[0];
    if (!col) return '';
    const f = this.filters()[col.key];
    if (f && numberFilterActive(f.num)) return numberFilterLabel(f.num);
    if (f && dateFilterActive(f.date)) return dateFilterLabel(f.date);
    const parts = [...(f?.text ? [f.text] : []), ...(f?.values ?? [])];
    return parts.length === 1 ? parts[0] : `${parts.length} ${col.plural}`;
  }

  removeSaved(id: number) {
    this.modalController.showAlert(
      {
        title: 'Slet filter',
        message: 'Ønsker du at slette dit gemte filter?',
        cancelBtn: 'Annuller',
        okBtn: { text: 'Slet', isDestructive: true },
      },
      (ok) => {
        if (ok) this.savedFilters.update((list) => list.filter((s) => s.id !== id));
      },
    );
  }

  saveCurrentFilter() {
    const suggestion = this.suggestFilterName();
    this.modalController.showModal(
      { component: SaveFilterDialogComponent, flavor: 'compact', componentProps: { suggestion } },
      (name?: string) => {
        if (!name) return;
        this.savedFilters.update((list) => [
          ...list,
          { id: this.nextSavedId++, name, filters: structuredClone(this.filters()), sortKey: this.sortKey(), sortDirection: this.sortDirection() },
        ]);
      },
    );
  }

  readonly columnFiltered = computed(() => this.activeFilters().length > 0);

  clearFilter(key: ColumnKey) {
    this.snapshotRows();
    this.filters.update((f) => this.withFilter(f, key, { text: '', values: null }));
  }

  clearAllFilters() {
    this.snapshotRows();
    this.filters.set({});
  }

  setValueFilter(key: ColumnKey, values: string[] | null) {
    this.snapshotRows();
    this.filters.update((f) => this.withFilter(f, key, { ...f[key], text: f[key]?.text ?? '', values }));
  }

  // Rækkernes placering før en sortering eller filtrering, så de kan glide til deres nye plads
  private rowTops = new Map<string, number>();
  private flipPending = false;

  private snapshotRows() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.rowTops.clear();
    this.host.nativeElement.querySelectorAll<HTMLElement>('tbody tr[data-id]').forEach((tr) => {
      this.rowTops.set(tr.dataset['id']!, tr.getBoundingClientRect().top);
    });
    this.flipPending = this.rowTops.size > 0;
  }

  private playRowMotion() {
    this.flipPending = false;
    const limit = window.innerHeight + 200;
    let entering = 0;
    this.host.nativeElement.querySelectorAll<HTMLElement>('tbody tr[data-id]').forEach((tr) => {
      const top = tr.getBoundingClientRect().top;
      if (top > limit || top < -200) return;
      const old = this.rowTops.get(tr.dataset['id']!);
      const options = { duration: 350, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' };
      // Nye rækker glider let ind nedefra efter hinanden, så skift mellem helt forskellige lister også er synligt
      if (old === undefined) {
        tr.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], {
          ...options,
          delay: Math.min(entering++, 12) * 25,
          fill: 'backwards',
        });
      } else if (Math.abs(old - top) > 1) tr.animate([{ transform: `translateY(${old - top}px)` }, { transform: 'none' }], options);
    });
    this.rowTops.clear();
  }

  private withFilter(
    all: Partial<Record<ColumnKey, ColumnFilter>>,
    key: ColumnKey,
    next: ColumnFilter,
  ): Partial<Record<ColumnKey, ColumnFilter>> {
    const copy = { ...all };
    if (!next.text && !next.values && !numberFilterActive(next.num) && !dateFilterActive(next.date)) delete copy[key];
    else copy[key] = next;
    return copy;
  }

  sortBy(key: ColumnKey, direction: 'asc' | 'desc') {
    this.snapshotRows();
    this.sortKey.set(key);
    this.sortDirection.set(direction);
  }

  setFrozen(key: ColumnKey, side: 'left' | 'right' | null) {
    if (side) this.placeFrozen(key, side);
    this.frozen.update((f) => {
      const copy = { ...f };
      if (side) copy[key] = side;
      else delete copy[key];
      return copy;
    });
  }

  // Fastgjorte kolonner flytter ind ved kanten: efter de øvrige fastgjorte til venstre, før de øvrige fastgjorte til højre
  private placeFrozen(key: ColumnKey, side: 'left' | 'right') {
    const frozen = this.frozen();
    const order = this.cfg().visibleColumns.filter((k) => k !== key);
    const same = order.map((k, i) => ({ k, i })).filter((x) => frozen[x.k] === side);
    // Dato ligger fast først til venstre, bilag og beløb til højre
    const pin = this.pinnedCfg();
    const leftBase = pin === 'none' ? 0 : 1;
    const rightBase = pin === 'both' ? Math.max(order.length - 2, leftBase) : order.length;
    const index = side === 'left' ? (same.length ? same[same.length - 1].i + 1 : leftBase) : same.length ? same[0].i : rightBase;
    order.splice(index, 0, key);
    this.configService.config.update((c) => ({ ...c, visibleColumns: order }));
  }

  resetColumns() {
    this.configService.resetColumns();
    this.filters.set({});
    this.frozen.set(this.defaultFrozen());
  }

  private defaultFrozen(): Partial<Record<ColumnKey, 'left' | 'right'>> {
    return {};
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

  /** Rækkerne, som de vises: udfoldede samleposteringer efterfølges af deres enkeltposteringer */
  readonly viewRows = computed(() =>
    this.displayRows().flatMap((p) => (p.children && this.expanded().has(p.id) ? [p, ...p.children] : [p])),
  );
  /** En markeret samlepostering tæller som én betaling, ellers tælles de markerede enkeltposteringer */
  readonly selectedPayments = computed(() =>
    this.rows().flatMap((r) => (this.selected().has(r.id) ? [r] : (r.children ?? []).filter((c) => this.selected().has(c.id)))),
  );
  private readonly allIds = computed(() => this.rows().flatMap((r) => [r.id, ...(r.children ?? []).map((c) => c.id)]));
  readonly allSelected = computed(() => this.allIds().length > 0 && this.allIds().every((id) => this.selected().has(id)));
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
    // Egne kolonnefiltre afløser det aktive hurtigfilter
    effect(() => {
      if (this.activeFilters().length) untracked(() => this.quick.update((q) => (q.size ? new Set() : q)));
    });
    // Slås en funktion fra, nulstilles det, den har sat
    effect(() => {
      const c = this.cfg();
      untracked(() => {
        if (!c.featureFilter) this.filters.set({});
        if (!c.featureQuick) this.quick.set(new Set());
        if (!c.featureSearch) this.search.set('');
        if (!c.featureSelect) this.selected.set(new Set());
      });
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

  readonly dragKey = signal<ColumnKey | null>(null);
  readonly dropKey = signal<ColumnKey | null>(null);
  readonly dropSide = signal<'before' | 'after'>('before');
  private justDragged = false;
  readonly dropLine = signal<{ left: number; top: number; height: number } | null>(null);

  // Rammer til skygge og indsætningslinje, så de dækker kolonnens fulde højde
  private updateReorderGuides(key: ColumnKey) {
    const root = this.host.nativeElement;
    const th = root.querySelector<HTMLElement>(`thead th[data-col="${key}"]`);
    const table = root.querySelector('table');
    if (!th || !table) return;
    const h = root.getBoundingClientRect();
    const t = th.getBoundingClientRect();
    const bottom = Math.min(table.getBoundingClientRect().bottom, window.innerHeight);
    const dropKey = this.dropKey();
    const over = dropKey ? root.querySelector<HTMLElement>(`thead th[data-col="${dropKey}"]`) : null;
    if (!over) {
      this.dropLine.set(null);
      return;
    }
    const r = over.getBoundingClientRect();
    this.dropLine.set({
      left: (this.dropSide() === 'before' ? r.left : r.right) - h.left - 1.5,
      top: r.top - h.top,
      height: Math.max(0, bottom - r.top),
    });
  }

  private ghost: HTMLElement | null = null;

  // Bygger et spøgelse af kolonnens synlige celler, som følger markøren
  private createGhost(key: ColumnKey, pointerX: number) {
    const root = this.host.nativeElement;
    const cells = Array.from(root.querySelectorAll<HTMLElement>(`[data-col="${key}"], td.lifted, th.lifted`)).filter(
      (c) => c.classList.contains('lifted') && c.getBoundingClientRect().bottom > 0 && c.getBoundingClientRect().top < window.innerHeight,
    );
    if (!cells.length) return;
    const first = cells[0].getBoundingClientRect();
    const g = document.createElement('div');
    g.setAttribute('aria-hidden', 'true');
    // Ligger direkte i body, så ingen forælder med transform flytter den; derfor inline typografi
    g.style.cssText = `position:fixed;z-index:1000;pointer-events:none;overflow:hidden;opacity:.6;background:var(--kirby-white);border-radius:var(--kirby-border-radius-xs);box-shadow:0 12px 32px rgb(0 0 0 / 16%);max-height:${window.innerHeight - first.top - 8}px`;
    for (const c of cells) {
      const r = c.getBoundingClientRect();
      const cell = document.createElement('div');
      cell.style.cssText = `display:flex;align-items:center;box-sizing:border-box;padding:0 var(--kirby-spacing-s);border-bottom:1px solid var(--kirby-semi-light);white-space:nowrap;overflow:hidden;font-size:var(--kirby-font-size-s);font-family:inherit`;
      cell.style.height = `${r.height}px`;
      cell.style.justifyContent = c.classList.contains('num') || getComputedStyle(c).textAlign === 'right' ? 'flex-end' : 'flex-start';
      cell.innerHTML = c.innerHTML;
      g.appendChild(cell);
    }
    g.style.width = `${first.width}px`;
    g.style.top = `${first.top}px`;
    g.style.left = `${first.left}px`;
    document.body.appendChild(g);
    this.ghost = g;
    this.ghostOffset = pointerX - first.left;
  }
  private ghostOffset = 0;
  private moveGhost(x: number) {
    if (this.ghost) this.ghost.style.left = `${x - this.ghostOffset}px`;
  }
  private removeGhost() {
    this.ghost?.remove();
    this.ghost = null;
  }

  // Langt tryk på en kolonneoverskrift løfter kolonnen, så den kan flyttes
  startReorder(e: PointerEvent, col: ColumnDef) {
    const target = e.target as HTMLElement;
    if (e.button !== 0 || target.closest('.resizer, app-column-menu, kirby-checkbox')) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let lifted = false;
    let lastX = startX;
    const root = this.host.nativeElement;
    const ths = () => Array.from(root.querySelectorAll<HTMLElement>('thead th[data-col]'));
    const timer = setTimeout(() => {
      lifted = true;
      this.dragKey.set(col.key);
      this.updateReorderGuides(col.key);
      document.body.style.cursor = 'grabbing';
      // Kolonnens celler får klassen "lifted" efter næste visning
      setTimeout(() => lifted && this.createGhost(col.key, lastX));
    }, 400);
    const move = (ev: PointerEvent) => {
      lastX = ev.clientX;
      this.moveGhost(ev.clientX);
      if (!lifted) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 6) cleanup();
        return;
      }
      const over = ths().find((th) => {
        const r = th.getBoundingClientRect();
        return ev.clientX >= r.left && ev.clientX <= r.right;
      });
      const key = over?.dataset['col'] as ColumnKey | undefined;
      if (!over || !key || key === col.key) {
        this.dropKey.set(null);
        this.updateReorderGuides(col.key);
        return;
      }
      const r = over.getBoundingClientRect();
      let side: 'before' | 'after' = ev.clientX < r.left + r.width / 2 ? 'before' : 'after';
      // Pladserne lige ved siden af kolonnen er dens egen plads, så markøren springer over dem
      const order = this.cfg().visibleColumns;
      const from = order.indexOf(col.key);
      const idx = order.indexOf(key);
      if (idx === from + 1 && side === 'before') side = 'after';
      if (idx === from - 1 && side === 'after') side = 'before';
      this.dropKey.set(key);
      this.dropSide.set(side);
      this.updateReorderGuides(col.key);
    };
    const cleanup = () => {
      clearTimeout(timer);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', cleanup);
      document.body.style.cursor = '';
      this.removeGhost();
      this.dragKey.set(null);
      this.dropKey.set(null);
      this.dropLine.set(null);
    };
    const up = () => {
      const target = this.dropKey();
      if (lifted && target) {
        const order = this.cfg().visibleColumns;
        // Flytter før eller efter målkolonnen
        const to = this.dropSide() === 'before' ? target : (order[order.indexOf(target) + 1] ?? null);
        if (to) this.configService.moveColumn(col.key, to);
        else this.configService.moveColumn(col.key, order[order.length - 1]);
      }
      if (lifted) {
        this.justDragged = true;
        setTimeout(() => (this.justDragged = false));
      }
      cleanup();
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', cleanup);
  }

  private innerScroll: Element | null = null;
  private readonly onScroll = () => {
    const root = this.host.nativeElement;
    const th = root.querySelector<HTMLElement>('thead th');
    const row = root.querySelector<HTMLElement>('tbody tr');
    const stuck = !!th && !!row && row.getBoundingClientRect().top < th.getBoundingClientRect().bottom - 1;
    root.classList.toggle('stuck', stuck);
  };

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

  // Kolonneoverskrifterne hæfter sig lige under værktøjslinjen, så dens højde skal kendes
  ngAfterViewChecked() {
    if (this.flipPending) this.playRowMotion();
    const el = this.host.nativeElement;
    const h = el.querySelector<HTMLElement>('.toolbar')?.getBoundingClientRect().height ?? 0;
    const v = `${h}px`;
    // Sticky-placeringen regnes inden for scroll-beholderens padding, så toppen rykkes op til kanten
    const pad = this.innerScroll ? parseFloat(getComputedStyle(this.innerScroll).paddingTop) || 0 : 0;
    if (el.style.getPropertyValue('--sticky-top') !== `${-pad}px`) el.style.setProperty('--sticky-top', `${-pad}px`);
    const visible = `${this.innerScroll?.clientHeight || window.innerHeight}px`;
    if (el.style.getPropertyValue('--scroll-h') !== visible) el.style.setProperty('--scroll-h', visible);
    if (el.style.getPropertyValue('--toolbar-h') !== v) el.style.setProperty('--toolbar-h', v);
  }

  ngOnDestroy() {
    document.removeEventListener('scroll', this.onScroll, true);
    this.innerScroll?.removeEventListener('scroll', this.onScroll);
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
    this.shadowLeft.set(canScroll && el.scrollWidth > el.clientWidth + 1);
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

  // Markering af celler: tryk og hold, og træk (kun når markering af celler er slået til)
  readonly cellSel = signal<{ r1: number; c1: number; r2: number; c2: number } | null>(null);
  private suppressClick = false;
  private pressTimer?: ReturnType<typeof setTimeout>;
  private dragging = false;
  private anchor?: { r: number; c: number };
  private pressPoint?: { x: number; y: number };
  private pressIsMouse = true;

  private cellAt(target: EventTarget | null) {
    const td = (target as HTMLElement | null)?.closest?.<HTMLElement>('td[data-c]');
    return td ? { r: Number(td.dataset['r']), c: Number(td.dataset['c']) } : null;
  }

  cellPointerDown(e: PointerEvent) {
    if (!this.cfg().cellSelection || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('input')) return;
    const cell = this.cellAt(e.target);
    this.cellSel.set(null);
    if (!cell) return;
    this.cellSel.set({ r1: cell.r, c1: cell.c, r2: cell.r, c2: cell.c });
    this.pressPoint = { x: e.clientX, y: e.clientY };
    this.anchor = cell;
    this.pressIsMouse = e.pointerType === 'mouse';
    // Med mus starter markeringen, så snart man trækker. På touch skal man holde fingeren nede først, ellers ruller siden
    if (!this.pressIsMouse) this.pressTimer = setTimeout(() => this.beginCellDrag(), 350);
    document.addEventListener('pointermove', this.onCellMove);
    document.addEventListener('pointerup', this.onCellUp);
    document.addEventListener('pointercancel', this.onCellUp);
  }

  private beginCellDrag() {
    if (!this.anchor) return;
    this.dragging = true;
    this.cellSel.set({ r1: this.anchor.r, c1: this.anchor.c, r2: this.anchor.r, c2: this.anchor.c });
    window.getSelection()?.removeAllRanges();
  }

  private readonly onCellMove = (e: PointerEvent) => {
    if (!this.dragging) {
      const p = this.pressPoint;
      if (!p || Math.hypot(e.clientX - p.x, e.clientY - p.y) <= 5) return;
      if (this.pressIsMouse) this.beginCellDrag();
      else this.stopCellDrag();
      if (!this.dragging) return;
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
    const one = r1 === r2 && c1 === c2 ? 'o' : '';
    return ['x', one, r === r1 ? 't' : '', r === r2 ? 'b' : '', c === c1 ? 'l' : '', c === c2 ? 'r' : ''].join(' ').trim();
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
      const p = this.viewRows()[Number(next.closest('tr')!.dataset['index']) - this.rowOffset()];
      if (p) this.detailId.set(p.id);
    }
  }

  cellKeydown(e: KeyboardEvent) {
    this.moveFocus(e);
    const s = this.cellSel();
    if (!s) return;
    if (e.key === 'Escape') {
      this.cellSel.set(null);
    }
  }

  // Browserens egen kopiér-hændelse er mere pålidelig end at gætte på tastekombinationen
  @HostListener('document:copy', ['$event'])
  onDocumentCopy(e: ClipboardEvent) {
    const text = this.selectionText();
    if (!this.cellSel() || !text || !e.clipboardData) return;
    e.clipboardData.setData('text/plain', text);
    e.clipboardData.setData('text/html', this.selectionHtml());
    e.preventDefault();
  }

  /** Antal markerede celler og rækker */
  readonly cellSelCount = computed(() => {
    const s = this.cellSel();
    if (!s) return null;
    const rows = Math.abs(s.r2 - s.r1) + 1;
    const cols = Math.abs(s.c2 - s.c1) + 1;
    if (rows * cols < 2) return null;
    return { cells: rows * cols, rows, cols };
  });

  private selectedCells(): string[][] {
    const s = this.cellSel();
    if (!s) return [];
    const rows = this.viewRows();
    const off = this.rowOffset();
    const cols = this.columns();
    const out: string[][] = [];
    for (let r = Math.min(s.r1, s.r2); r <= Math.max(s.r1, s.r2); r++) {
      const line: string[] = [];
      for (let c = Math.min(s.c1, s.c2); c <= Math.max(s.c1, s.c2); c++) {
        line.push(rows[r - off] && cols[c] ? this.plainValue(rows[r - off], cols[c].key) : '');
      }
      out.push(line);
    }
    return out;
  }

  private selectionText() {
    return this.selectedCells().map((l) => l.join('\t')).join('\n');
  }

  // HTML-tabel gør, at Noter, Word og Excel indsætter celler som en rigtig tabel
  private selectionHtml() {
    const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const rows = this.selectedCells()
      .map((l) => '<tr>' + l.map((v) => `<td>${esc(v)}</td>`).join('') + '</tr>')
      .join('');
    return `<table><tbody>${rows}</tbody></table>`;
  }

  copySelection() {
    const text = this.selectionText();
    if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
      const item = new ClipboardItem({
        'text/plain': new Blob([text], { type: 'text/plain' }),
        'text/html': new Blob([this.selectionHtml()], { type: 'text/html' }),
      });
      navigator.clipboard.write([item]).catch(() => this.legacyCopy(text));
    } else {
      this.legacyCopy(text);
    }
  }

  private legacyCopy(text: string) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }

  exportSelection() {
    const csv = this.selectedCells()
      .map((l) => l.map((v) => `"${v.replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'markerede-celler.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Samlepostering der kan foldes ud
  readonly expanded = signal<ReadonlySet<number>>(new Set());
  isExpanded(p: Payment) {
    return this.expanded().has(p.id);
  }
  toggleGroup(p: Payment, e: Event) {
    e.stopPropagation();
    this.expanded.update((s) => {
      const next = new Set(s);
      if (!next.delete(p.id)) next.add(p.id);
      return next;
    });
  }

  readonly hasGroups = computed(() => this.displayRows().some((p) => !!p.children));

  // Inline-redigering som i AG Grid: dobbeltklik, Enter/F2 eller bare begynd at skrive i den markerede celle
  readonly editingId = signal<number | null>(null);
  readonly editValue = signal('');
  startEdit(p: Payment, e?: Event, initial?: string) {
    e?.stopPropagation();
    this.editValue.set(initial ?? p.reference);
    this.editingId.set(p.id);
    setTimeout(() => {
      const input = this.host.nativeElement.querySelector<HTMLInputElement>('input.bare-input');
      if (!input) return;
      input.focus();
      if (initial === undefined) input.select();
      else input.setSelectionRange(initial.length, initial.length);
    });
  }
  commitEdit(p: Payment) {
    if (this.editingId() !== p.id) return;
    this.editingId.set(null);
    const value = this.editValue().trim();
    if (value === p.reference) return;
    const sel = this.cellSel();
    this.service.setReference(p.id, value);
    // Rækkerne gendannes ved ændring af data, og så ville markeringen forsvinde
    setTimeout(() => this.cellSel.set(sel));
  }
  cancelEdit() {
    this.editingId.set(null);
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(e: KeyboardEvent) {
    const s = this.cellSel();
    if (!s || !this.cfg().inlineEdit || this.editingId() !== null) return;
    if (s.r1 !== s.r2 || s.c1 !== s.c2 || this.columns()[s.c1]?.key !== 'reference') return;
    if ((e.target as HTMLElement).closest?.('input,textarea,select,button,[contenteditable],ion-modal,kirby-modal-wrapper,kirby-menu')) return;
    const p = this.viewRows()[s.r1 - this.rowOffset()];
    if (!p) return;
    if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      this.startEdit(p);
    } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      this.startEdit(p, undefined, e.key);
    }
  }

  // Deling af data: alle filtrerede rækker med de viste kolonner
  private exportMatrix(): string[][] {
    const cols = this.columns();
    return [
      cols.map((c) => c.label),
      ...this.rows().map((p) => cols.map((c) => (c.key === 'amount' ? this.formatAmount(p.amount) : this.plainValue(p, c.key)))),
    ];
  }
  private download(content: string, type: string, name: string) {
    const url = URL.createObjectURL(new Blob(['\ufeff' + content], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }
  exportAllCsv() {
    const csv = this.exportMatrix().map((l) => l.map((v) => `"${v.replace(/"/g, '""')}"`).join(';')).join('\r\n');
    this.download(csv, 'text/csv;charset=utf-8', 'betalinger.csv');
  }
  exportAllExcel() {
    const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const rows = this.exportMatrix().map((l) => '<tr>' + l.map((v) => `<td>${esc(v)}</td>`).join('') + '</tr>').join('');
    this.download(`<table>${rows}</table>`, 'application/vnd.ms-excel', 'betalinger.xls');
  }
  shareLink() {
    const url = location.href;
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).catch(() => this.legacyCopy(url));
    else this.legacyCopy(url);
  }

  clearCellSel() {
    this.cellSel.set(null);
  }

  sort(key: ColumnKey) {
    if (this.justDragged) return;
    this.snapshotRows();
    if (this.sortKey() === key) {
      this.sortDirection.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortDirection.set(defaultDirection(COLUMNS.find((c) => c.key === key) ?? {}));
    }
  }

  isSelected(p: Payment): boolean {
    return this.selected().has(p.id);
  }

  /** Samleposteringens afkrydsningsfelt er delvist markeret, når kun nogle af enkeltposteringerne er valgt */
  isPartlySelected(p: Payment): boolean {
    if (!p.children || this.isSelected(p)) return false;
    return p.children.some((c) => this.selected().has(c.id));
  }

  toggleRow(p: Payment, checked: boolean) {
    this.selected.update((s) => {
      const next = new Set(s);
      const ids = [p.id, ...(p.children ?? []).map((c) => c.id)];
      ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      if (p.parentId !== undefined) {
        const parent = this.rows().find((r) => r.id === p.parentId);
        if (parent?.children?.every((c) => next.has(c.id))) next.add(parent.id);
        else next.delete(p.parentId);
      }
      return next;
    });
  }

  toggleAll(checked: boolean) {
    this.selected.set(checked ? new Set(this.allIds()) : new Set());
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
    const col = target?.closest<HTMLElement>('td[data-col]')?.dataset['col'];
    if (col) this.focusCol.set(col as ColumnKey);
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

  statusAsOutline(status: PaymentStatus): boolean {
    return (
      this.cfg().statusStyle === 'flag' &&
      this.cfg().noActionStatusStyle === 'outline' &&
      !STATUS_NEEDS_ATTENTION.has(status)
    );
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
