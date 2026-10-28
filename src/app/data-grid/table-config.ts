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
  /** Bestemmer teksten på sorteringsmulighederne. Standard er tekst. */
  kind?: 'text' | 'number' | 'date';
  /** Hvordan kolonnen filtreres. Standard er valg af enkelte værdier. */
  filter?: 'values' | 'number' | 'text';
}

/** Retningen, kolonnen sorteres i første gang. Datoer starter med de nyeste. */
export function defaultDirection(col: Pick<ColumnDef, 'kind'>): 'asc' | 'desc' {
  return col.kind === 'date' ? 'desc' : 'asc';
}

export const COLUMNS: ColumnDef[] = [
  { key: 'date', label: 'Dato', priority: 1, width: 110, noHide: true, kind: 'date' },
  { key: 'recipient', label: 'Modtager', priority: 0, width: 240, noHide: true, filter: 'text' },
  { key: 'amount', label: 'Beløb', align: 'right', priority: 2, width: 120, noHide: true, kind: 'number', filter: 'number' },
  { key: 'currency', label: 'Valuta', priority: 7, width: 80 },
  { key: 'type', label: 'Betalingstype', priority: 5, width: 140 },
  { key: 'subtype', label: 'Undertype', priority: 8, width: 130 },
  { key: 'toAccount', label: 'Til konto', priority: 9, width: 190, filter: 'text' },
  { key: 'fromAccount', label: 'Fra konto', priority: 10, width: 160 },
  { key: 'accountOwner', label: 'Kontoejer', priority: 12, width: 200 },
  { key: 'reference', label: 'Bilagsreference', priority: 11, width: 150, filter: 'text' },
  { key: 'status', label: 'Status', priority: 3, width: 200 },
  { key: 'recipientCheck', label: 'Modtagertjek', priority: 6, width: 170 },
];

export type Density = 'compact' | 'standard' | 'spacious';
export type TextHandling = 'truncate' | 'wrap';
export type PinnedColumns = 'none' | 'left' | 'both';
export type StatusStyle = 'flag' | 'text';
export type NoActionStatusStyle = 'text' | 'outline';
export type ActionsForce = 'auto' | 'icon' | 'full';
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
  noActionStatusStyle: NoActionStatusStyle;
  actionsForce: ActionsForce;
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
  /** Brugeren må flytte rundt på kolonnerne. */
  userColumnReorder: boolean;
  /** Brugeren må ændre rækkehøjde. */
  userDensity: boolean;
  /** Brugeren må til- og fravælge zebrastriber. */
  userZebra: boolean;
  /** Brugeren må til- og fravælge kolonnelinjer. */
  userDividers: boolean;
  /** Brugeren må til- og fravælge horisontal rulning. */
  userScroll: boolean;
  /** Funktioner i tabellen. Slås de fra, vises de ikke. */
  featureSelect: boolean;
  featureQuick: boolean;
  featureSearch: boolean;
  featureSettings: boolean;
  featureSort: boolean;
  featureFilter: boolean;
  featureRowActions: boolean;
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
  noActionStatusStyle: 'text',
  actionsForce: 'auto',
  checkStyle: 'avatar',
  currencyStyle: 'flag',
  checkboxSize: 'xs',
  cardsOnSmallScreens: true,
  detailMode: 'inline',
  container: 'card',
  columnOverflow: 'hide',
  loading: 'all',
  visibleColumns: COLUMNS.map((c) => c.key),
  userColumnChoice: true,
  userColumnWidth: true,
  userColumnReorder: true,
  userDensity: true,
  userZebra: true,
  userDividers: true,
  userScroll: true,
  featureSelect: true,
  featureQuick: true,
  featureSearch: true,
  featureSettings: true,
  featureSort: true,
  featureFilter: true,
  featureRowActions: true,
};

export type PresetId = 'simple' | 'complex';

/** Hurtigvalg i udviklerindstillingerne. De ændrer kun det, der er nævnt her. */
export const PRESETS: Record<PresetId, Partial<TableConfig>> = {
  simple: {
    container: 'card',
    detailMode: 'modal',
    pinned: 'none',
    columnOverflow: 'hide',
    columnDividers: false,
    zebra: false,
    featureSelect: false,
    featureQuick: false,
    featureSearch: false,
    featureSettings: false,
    featureSort: false,
    featureFilter: false,
    featureRowActions: false,
    userColumnChoice: false,
    userColumnWidth: false,
    userColumnReorder: false,
    userDensity: false,
    userZebra: false,
    userDividers: false,
    userScroll: false,
  },
  complex: {
    container: 'canvas',
    pinned: 'both',
    columnOverflow: 'hide',
    columnDividers: true,
    zebra: true,
    featureSelect: true,
    featureQuick: true,
    featureSearch: true,
    featureSettings: true,
    featureSort: true,
    featureFilter: true,
    featureRowActions: true,
    userColumnChoice: true,
    userColumnWidth: true,
    userColumnReorder: true,
    userDensity: true,
    userZebra: true,
    userDividers: true,
    userScroll: true,
  },
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
    // Uden Indstillinger-knappen har brugeren ingen egne valg
    const o = c.featureSettings ? this.overrides() : {};
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

  applyPreset(id: PresetId) {
    this.overrides.set({});
    this.userWidths.set({});
    this.config.update((c) => ({ ...c, ...PRESETS[id], visibleColumns: [...c.visibleColumns] }));
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
    this.config.update((c) => {
      const rest = c.visibleColumns.filter((k) => k !== key);
      if (!visible) return { ...c, visibleColumns: rest };
      // Ny kolonne placeres foran den første, der står efter den i standardrækkefølgen
      const rank = (k: ColumnKey) => COLUMNS.findIndex((col) => col.key === k);
      const at = rest.findIndex((k) => rank(k) > rank(key));
      rest.splice(at < 0 ? rest.length : at, 0, key);
      return { ...c, visibleColumns: rest };
    });
  }

  /** Flytter en kolonne til den plads, hvor målkolonnen står nu. */
  moveColumn(key: ColumnKey, target: ColumnKey) {
    this.config.update((c) => {
      const list = c.visibleColumns.filter((k) => k !== key);
      const to = c.visibleColumns.indexOf(target);
      const from = c.visibleColumns.indexOf(key);
      if (from < 0 || to < 0 || key === target) return c;
      list.splice(to, 0, key);
      return { ...c, visibleColumns: list };
    });
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
