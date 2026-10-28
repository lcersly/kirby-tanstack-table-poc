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
const MOCK_TODAY = '2026-10-14';
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

export interface ColumnFilter {
  text: string;
  values: string[] | null;
  num?: NumberFilter | null;
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
  readonly flagSize = computed(() => (this.cfg().density === 'spacious' ? 'sm' : 'xs') as 'sm' | 'xs');

  private effWidth(c: ColumnDef): number {
    return this.widthOf(c) ?? c.width;
  }

  readonly columns = computed<ColumnDef[]>(() => {
    const order = this.cfg().visibleColumns;
    const chosen = COLUMNS.filter((c) => c.noHide || order.includes(c.key)).sort(
      (a, b) => order.indexOf(a.key) - order.indexOf(b.key),
    );
    // Inline-panelet skubber tabellen og skjuler de mindst vigtige kolonner
    const hide = this.cfg().columnOverflow === 'hide' || this.inlineOpen();
    if (!hide) return chosen;
    const fixed = this.selectWidth() + this.actionsWidth() + FIT_MARGIN;
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
    return c.featureQuick || c.featureSearch || c.featureSettings || this.activeFilters().length > 0 || this.savedFilters().length > 0;
  });

  readonly checkboxSize = computed(() => (this.cfg().density === 'spacious' ? 'md' : this.cfg().checkboxSize));
  readonly checkAvatarSize = computed(() => ({ compact: 'xxs', standard: 'sm', spacious: 'xs' } as const)[this.cfg().density]);
  readonly avatarSize = computed(() => (this.cfg().density === 'compact' ? 'xxs' : 'xs'));

  readonly rows = computed(() => {
    const key = this.sortKey();
    const dir = this.sortDirection() === 'asc' ? 1 : -1;
    const filters = this.filters();
    // Hurtigfiltrene er inaktive, mens der filtreres i kolonnerne
    const quick = this.columnFiltered() ? [] : QUICK_FILTERS.filter((q) => this.quick().has(q.id));
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
      if (col.filter === 'number') {
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
      item('all', 'Alle', base.length, 'medium'),
      ...QUICK_FILTERS.map((q) =>
        item(q.id, q.label, base.filter((p) => q.test(p)).length, q.id === 'rejected' || q.id === 'error' ? 'warning' : 'medium'),
      ),
    ];
  });
  readonly quickIndex = computed(() => {
    const id = this.columnFiltered() ? undefined : [...this.quick()][0];
    return id ? this.quickItems().findIndex((q) => q.id === id) : 0;
  });

  setQuick(index: number) {
    this.snapshotRows();
    const id = this.quickItems()[index]?.id;
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

  // Ét valg pr. kolonne: antal valgte filtre og en tekst til chippen
  readonly activeFilters = computed(() =>
    COLUMNS.flatMap((col) => {
      const f = this.filters()[col.key];
      if (!f) return [];
      if (numberFilterActive(f.num)) return [{ key: col.key, count: 1, label: `${col.label}: ${numberFilterLabel(f.num)}` }];
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
  readonly savedItems = computed<SegmentItem[]>(() => this.visibleSaved().map((s) => ({ id: String(s.id), text: s.name })));
  readonly savedIndex = computed(() => this.visibleSaved().findIndex((s) => s.id === this.activeSavedId()));
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

  saveCurrentFilter() {
    const suggestion = this.activeFilters().map((f) => f.label).join(', ').slice(0, 40);
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
    this.host.nativeElement.querySelectorAll<HTMLElement>('tbody tr[data-id]').forEach((tr) => {
      const top = tr.getBoundingClientRect().top;
      if (top > limit || top < -200) return;
      const old = this.rowTops.get(tr.dataset['id']!);
      const options = { duration: 350, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' };
      if (old === undefined) tr.animate([{ opacity: 0 }, { opacity: 1 }], options);
      else if (Math.abs(old - top) > 1) tr.animate([{ transform: `translateY(${old - top}px)` }, { transform: 'none' }], options);
    });
    this.rowTops.clear();
  }

  private withFilter(
    all: Partial<Record<ColumnKey, ColumnFilter>>,
    key: ColumnKey,
    next: ColumnFilter,
  ): Partial<Record<ColumnKey, ColumnFilter>> {
    const copy = { ...all };
    if (!next.text && !next.values && !numberFilterActive(next.num)) delete copy[key];
    else copy[key] = next;
    return copy;
  }

  sortBy(key: ColumnKey, direction: 'asc' | 'desc') {
    this.snapshotRows();
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

  readonly dragKey = signal<ColumnKey | null>(null);
  readonly dropKey = signal<ColumnKey | null>(null);
  readonly dropSide = signal<'before' | 'after'>('before');
  private justDragged = false;
  readonly liftRect = signal<{ left: number; top: number; width: number; height: number } | null>(null);
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
    const grow = t.width * 0.02;
    this.liftRect.set({ left: t.left - h.left - grow, top: t.top - h.top, width: t.width + grow * 2, height: Math.max(0, bottom - t.top) });
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

  // Langt tryk på en kolonneoverskrift løfter kolonnen, så den kan flyttes
  startReorder(e: PointerEvent, col: ColumnDef) {
    const target = e.target as HTMLElement;
    if (e.button !== 0 || target.closest('.resizer, app-column-menu, kirby-checkbox')) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let lifted = false;
    const root = this.host.nativeElement;
    const ths = () => Array.from(root.querySelectorAll<HTMLElement>('thead th[data-col]'));
    const timer = setTimeout(() => {
      lifted = true;
      this.dragKey.set(col.key);
      this.updateReorderGuides(col.key);
      document.body.style.cursor = 'grabbing';
    }, 400);
    const move = (ev: PointerEvent) => {
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
      this.dragKey.set(null);
      this.dropKey.set(null);
      this.liftRect.set(null);
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
