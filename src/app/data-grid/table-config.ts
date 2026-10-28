import { Injectable, computed, signal } from '@angular/core';

export type ColumnKey =
  | 'date'
  | 'recipient'
  | 'amount'
  | 'currency'
  | 'type'
  | 'subtype'
  | 'toAccount'
  | 'fromAccount'
  | 'accountOwner'
  | 'reference'
  | 'status'
  | 'recipientCheck';

export interface ColumnDef {
  key: ColumnKey;
  label: string;
  align?: 'right';
  /** Lavere tal = vigtigere. Bruges, når kolonner skjules ved pladsmangel. */
  priority: number;
  /** Cirka bredde i px. Bruges, når kolonner skjules ved pladsmangel. */
  width: number;
  /** Kolonnen skjules aldrig ved pladsmangel og kan ikke fravælges af brugeren. */
  noHide?: boolean;
}

export const COLUMNS: ColumnDef[] = [
  { key: 'date', label: 'Dato', priority: 1, width: 110, noHide: true },
  { key: 'recipient', label: 'Modtager', priority: 0, width: 240, noHide: true },
  { key: 'amount', label: 'Beløb', align: 'right', priority: 2, width: 120, noHide: true },
  { key: 'currency', label: 'Valuta', priority: 7, width: 80 },
  { key: 'type', label: 'Betalingstype', priority: 5, width: 140 },
  { key: 'subtype', label: 'Undertype', priority: 8, width: 130 },
  { key: 'toAccount', label: 'Til konto', priority: 9, width: 190 },
  { key: 'fromAccount', label: 'Fra konto', priority: 10, width: 160 },
  { key: 'accountOwner', label: 'Kontoejer', priority: 12, width: 200 },
  { key: 'reference', label: 'Bilagsreference', priority: 11, width: 150 },
  { key: 'status', label: 'Status', priority: 3, width: 200 },
  { key: 'recipientCheck', label: 'Modtagertjek', priority: 6, width: 170 },
];

export type Density = 'compact' | 'standard' | 'spacious';
export type TextHandling = 'truncate' | 'wrap';
export type PinnedColumns = 'none' | 'left' | 'both';
export type StatusStyle = 'flag' | 'text';
export type CheckStyle = 'flag' | 'avatar';
export type DetailMode = 'none' | 'modal' | 'side-modal' | 'side-nonmodal' | 'inline' | 'page';
export type Container = 'canvas' | 'card' | 'stroked-card';
export type CheckboxSize = 'md' | 'xs';
export type CurrencyStyle = 'flag' | 'code';
export type Highlight = 'row' | 'cell';
export type LoadingMode = 'all' | 'paging' | 'lazy' | 'virtual';
export type ColumnOverflow = 'scroll' | 'hide';

export interface TableConfig {
  density: Density;
  textHandling: TextHandling;
  pinned: PinnedColumns;
  stickyHeader: boolean;
  zebra: boolean;
  /** Lodrette skillelinjer mellem kolonner. */
  columnDividers: boolean;
  /** Om det er hele rækken eller den enkelte celle, der fremhæves ved hover. */
  highlight: Highlight;
  /** true = handlinger ligger altid i en overflow-menu. false = knapperne tilpasser sig pladsen. */
  actionsOverflow: boolean;
  statusStyle: StatusStyle;
  checkStyle: CheckStyle;
  currencyStyle: CurrencyStyle;
  checkboxSize: CheckboxSize;
  cardsOnSmallScreens: boolean;
  detailMode: DetailMode;
  container: Container;
  columnOverflow: ColumnOverflow;
  /** Hvordan rækkerne hentes og vises. */
  loading: LoadingMode;
  visibleColumns: ColumnKey[];
  /** Brugeren kan selv vælge, hvilke kolonner der vises. */
  userColumnChoice: boolean;
  /** Brugeren må justere kolonnernes bredde. */
  userColumnWidth: boolean;
  /** Brugeren må ændre rækkehøjde. */
  userDensity: boolean;
  /** Brugeren må til- og fravælge zebrastriber. */
  userZebra: boolean;
  /** Brugeren må til- og fravælge kolonnelinjer. */
  userDividers: boolean;
  /** Brugeren må til- og fravælge horisontal rulning. */
  userScroll: boolean;
}

/** Brugerens egne valg, som ligger oven på udviklerindstillingerne */
export interface UserOverrides {
  density?: Density;
  zebra?: boolean;
  columnDividers?: boolean;
  columnOverflow?: ColumnOverflow;
}

export const DEFAULT_CONFIG: TableConfig = {
  density: 'standard',
  textHandling: 'truncate',
  pinned: 'both',
  stickyHeader: true,
  zebra: false,
  columnDividers: true,
  highlight: 'row',
  actionsOverflow: true,
  statusStyle: 'flag',
  checkStyle: 'avatar',
  currencyStyle: 'flag',
  checkboxSize: 'xs',
  cardsOnSmallScreens: true,
  detailMode: 'inline',
  container: 'canvas',
  columnOverflow: 'hide',
  loading: 'all',
  visibleColumns: COLUMNS.map((c) => c.key),
  userColumnChoice: true,
  userColumnWidth: true,
  userDensity: true,
  userZebra: true,
  userDividers: true,
  userScroll: true,
};

@Injectable({ providedIn: 'root' })
export class TableConfigService {
  readonly config = signal<TableConfig>({ ...DEFAULT_CONFIG, visibleColumns: [...DEFAULT_CONFIG.visibleColumns] });

  /** Brugerens valg og kolonnebredder. Gælder kun for det, udvikleren har givet brugeren lov til */
  readonly overrides = signal<UserOverrides>({});
  readonly userWidths = signal<Partial<Record<ColumnKey, number>>>({});

  /** Det, tabellen faktisk vises med: udviklerindstillinger + brugerens tilladte valg */
  readonly effective = computed<TableConfig>(() => {
    const c = this.config();
    const o = this.overrides();
    return {
      ...c,
      density: c.userDensity && o.density ? o.density : c.density,
      zebra: c.userZebra && o.zebra !== undefined ? o.zebra : c.zebra,
      columnDividers: c.userDividers && o.columnDividers !== undefined ? o.columnDividers : c.columnDividers,
      columnOverflow: c.userScroll && o.columnOverflow ? o.columnOverflow : c.columnOverflow,
    };
  });

  setOverride<K extends keyof UserOverrides>(key: K, value: UserOverrides[K]) {
    this.overrides.update((o) => ({ ...o, [key]: value }));
  }

  setUserWidth(key: ColumnKey, width: number | null) {
    this.userWidths.update((w) => {
      const copy = { ...w };
      if (width === null) delete copy[key];
      else copy[key] = Math.max(60, Math.round(width));
      return copy;
    });
  }

  resetUserView() {
    this.overrides.set({});
    this.userWidths.set({});
    this.resetColumns();
  }

  set<K extends keyof TableConfig>(key: K, value: TableConfig[K]) {
    this.config.update((c) => ({ ...c, [key]: value }));
  }

  toggleColumn(key: ColumnKey, visible: boolean) {
    this.config.update((c) => ({
      ...c,
      visibleColumns: COLUMNS.map((col) => col.key).filter((k) =>
        k === key ? visible : c.visibleColumns.includes(k),
      ),
    }));
  }

  resetColumns() {
    this.config.update((c) => ({ ...c, visibleColumns: [...DEFAULT_CONFIG.visibleColumns] }));
  }

  reset() {
    this.overrides.set({});
    this.userWidths.set({});
    this.config.set({ ...DEFAULT_CONFIG, visibleColumns: [...DEFAULT_CONFIG.visibleColumns] });
  }
}
