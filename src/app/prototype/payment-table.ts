import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent } from '@kirbydesign/designsystem/button';
import { DropdownComponent } from '@kirbydesign/designsystem/dropdown';
import { FormFieldComponent, InputComponent } from '@kirbydesign/designsystem/form-field';
import {
  SegmentedControlComponent,
  SegmentItem,
} from '@kirbydesign/designsystem/segmented-control';
import {
  ColumnDef,
  ColumnFiltersState,
  FlexRender,
  flexRenderComponent,
  functionalUpdate,
  injectTable,
  columnFilteringFeature,
  rowSelectionFeature,
  RowSelectionState,
  rowSortingFeature,
  SortingState,
  tableFeatures,
} from '@tanstack/angular-table';
import {
  DataGridCellDirective,
  DataGridComponent,
  DataGridHeaderCellComponent,
  DataGridHeaderRowDirective,
  DataGridRowDirective,
  DataGridTableDirective,
  kirbyDataGridSelectionColumn,
} from '@kirbydesign/designsystem/data-grid';

import { amountFormatter, dateFormatter, PAYMENT_CURRENCIES, PaymentRecord } from './payment-data';
import { PaymentStatusCell } from './payment-status-cell';

const collator = new Intl.Collator('da-DK', { numeric: true, sensitivity: 'base' });
const integerFormatter = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 });
const features = tableFeatures({ rowSortingFeature, columnFilteringFeature, rowSelectionFeature });

interface AmountFilter {
  currency: string;
  minOre: number | null;
  maxOre: number | null;
}

type AmountField = 'currency' | 'minimum' | 'maximum';

function parseAmount(value: string): number | null | undefined {
  const text = value.trim();
  if (!text) return null;
  const match = /^(\d+)(?:[,.](\d{1,2}))?$/.exec(text);
  if (!match) return undefined;
  const whole = match[1].replace(/^0+/, '') || '0';
  if (whole.length > 14) return undefined;
  const minorUnits = BigInt(whole) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
  return minorUnits <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(minorUnits) : undefined;
}

function formatAmount(minorUnits: number): string {
  const amount = BigInt(minorUnits);
  return `${integerFormatter.format(amount / 100n)},${String(amount % 100n).padStart(2, '0')}`;
}

function isAmountFilter(value: unknown): value is AmountFilter {
  if (!value || typeof value !== 'object') return false;
  const filter = value as Partial<AmountFilter>;
  return (
    typeof filter.currency === 'string' &&
    (filter.minOre === null || typeof filter.minOre === 'number') &&
    (filter.maxOre === null || typeof filter.maxOre === 'number')
  );
}

const columns: ColumnDef<typeof features, PaymentRecord>[] = [
  kirbyDataGridSelectionColumn({
    rowLabel: (payment: PaymentRecord) =>
      `betaling til ${payment.recipient}, ${payment.date}, ${payment.amount} ${payment.currency}`,
  }),
  {
    id: 'date',
    accessorKey: 'dateTimestamp',
    header: 'Dato',
    cell: (context) => dateFormatter.format(context.getValue<number>()),
  },
  { accessorKey: 'recipient', header: 'Modtager' },
  {
    id: 'amount',
    accessorKey: 'amountInOre',
    header: 'Beløb',
    cell: (context) => amountFormatter.format(context.getValue<number>() / 100),
  },
  { accessorKey: 'currency', header: 'Valuta' },
  { accessorKey: 'paymentType', header: 'Betalingstype' },
  { accessorKey: 'destinationAccount', header: 'Modtagerkonto' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) =>
      flexRenderComponent(PaymentStatusCell, { inputs: { status: row.original.status } }),
  },
];

const sortFields: Record<string, keyof PaymentRecord> = {
  date: 'dateTimestamp',
  recipient: 'recipient',
  amount: 'amountInOre',
  currency: 'currency',
  paymentType: 'paymentType',
  destinationAccount: 'destinationAccount',
  status: 'status',
};

const ALL_STATUSES = 'all';
const statusItems: SegmentItem[] = [
  { id: ALL_STATUSES, text: 'Alle' },
  { id: 'Gennemført', text: 'Gennemført' },
  { id: 'Afventer', text: 'Afventer' },
  { id: 'Afvist', text: 'Afvist' },
];

@Component({
  selector: 'app-prototype-payment-table',
  imports: [
    ButtonComponent,
    DropdownComponent,
    FormFieldComponent,
    InputComponent,
    ReactiveFormsModule,
    SegmentedControlComponent,
    DataGridComponent,
    DataGridTableDirective,
    DataGridHeaderRowDirective,
    DataGridHeaderCellComponent,
    DataGridRowDirective,
    DataGridCellDirective,
    FlexRender,
  ],
  templateUrl: './payment-table.html',
  styleUrl: './payment-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentTablePrototype {
  readonly payments = input.required<PaymentRecord[]>();
  private readonly injector = inject(Injector);
  private readonly detailsHeading = viewChild<ElementRef<HTMLElement>>('detailsHeading');
  private readonly gridTable = viewChild<ElementRef<HTMLTableElement>>('gridTable');
  private returnFocus: HTMLElement | null = null;
  protected readonly statusItems = statusItems;
  protected readonly currencies: string[] = [...PAYMENT_CURRENCIES];
  protected readonly amountForm = new FormGroup({
    currency: new FormControl('', { nonNullable: true }),
    minimum: new FormControl('', { nonNullable: true }),
    maximum: new FormControl('', { nonNullable: true }),
  });
  protected readonly amountError = signal<string | null>(null);
  protected readonly amountErrorFields = signal<AmountField[]>([]);
  protected readonly activeAmountFilter = computed(() => {
    const value = this.columnFilters().find((filter) => filter.id === 'amount')?.value;
    return isAmountFilter(value) ? value : null;
  });
  protected readonly amountFilterSummary = computed(() => {
    const filter = this.activeAmountFilter();
    if (!filter) return null;
    const min = filter.minOre === null ? null : formatAmount(filter.minOre);
    const max = filter.maxOre === null ? null : formatAmount(filter.maxOre);
    if (min !== null && max !== null) return `${min} - ${max} ${filter.currency}`;
    return min !== null ? `Fra ${min} ${filter.currency}` : `Til ${max} ${filter.currency}`;
  });
  protected readonly statusFilterIndex = computed(() => {
    const status = this.columnFilters().find((filter) => filter.id === 'status')?.value;
    return statusItems.findIndex((item) => item.id === (status ?? ALL_STATUSES));
  });
  protected readonly filteredAndSortedPayments = computed(() => {
    const status = this.columnFilters().find((filter) => filter.id === 'status')?.value;
    const amount = this.activeAmountFilter();
    const filtered = this.payments().filter(
      (payment) =>
        (!status || payment.status === status) &&
        (!amount ||
          (payment.currency === amount.currency &&
            (amount.minOre === null || payment.amountInOre >= amount.minOre) &&
            (amount.maxOre === null || payment.amountInOre <= amount.maxOre))),
    );
    const sort = this.sorting()[0];
    const field = sort ? sortFields[sort.id] : undefined;
    if (!sort || !field) return filtered;

    const direction = sort.desc ? -1 : 1;
    return [...filtered].sort((a, b) => {
      const left = a[field];
      const right = b[field];
      const comparison =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : collator.compare(String(left), String(right));
      return comparison * direction;
    });
  });
  protected readonly selectedPayment = computed(() => {
    const id = this.detailId();
    return id ? this.payments().find((payment) => payment.id === id) : undefined;
  });
  protected readonly selectedCount = computed(
    () => Object.values(this.rowSelection()).filter(Boolean).length,
  );
  protected readonly hiddenSelectedCount = computed(() => {
    const shownIds = new Set(this.filteredAndSortedPayments().map((payment) => payment.id));
    return Object.entries(this.rowSelection()).filter(
      ([id, selected]) => selected && !shownIds.has(id),
    ).length;
  });
  protected readonly sorting = signal<SortingState>([]);
  protected readonly columnFilters = signal<ColumnFiltersState>([]);
  protected readonly rowSelection = signal<RowSelectionState>({});
  protected readonly detailId = signal<string | null>(null);

  readonly table = injectTable(() => ({
    features,
    columns,
    data: this.filteredAndSortedPayments(),
    getRowId: (payment) => payment.id,
    manualSorting: true,
    manualFiltering: true,
    enableMultiSort: false,
    enableSortingRemoval: true,
    sortDescFirst: false,
    state: {
      sorting: this.sorting(),
      columnFilters: this.columnFilters(),
      rowSelection: this.rowSelection(),
    },
    onSortingChange: (updater) => this.sorting.set(functionalUpdate(updater, this.sorting())),
    onColumnFiltersChange: (updater) =>
      this.columnFilters.set(functionalUpdate(updater, this.columnFilters())),
    onRowSelectionChange: (updater) =>
      this.rowSelection.set(functionalUpdate(updater, this.rowSelection())),
  }));

  constructor() {
    effect(() => {
      this.payments();
      this.rowSelection.set({});
      this.detailId.set(null);
    });
  }

  protected onStatusSelect(item: SegmentItem): void {
    this.table.getColumn('status')?.setFilterValue(item.id === ALL_STATUSES ? undefined : item.id);
  }

  protected applyAmountFilter(): void {
    const { currency, minimum, maximum } = this.amountForm.getRawValue();
    const minOre = parseAmount(minimum);
    const maxOre = parseAmount(maximum);
    if (minOre === undefined || maxOre === undefined) {
      this.reportAmountError('Indtast beløb uden tusindtalsseparator og med højst to decimaler.', [
        ...(minOre === undefined ? (['minimum'] as const) : []),
        ...(maxOre === undefined ? (['maximum'] as const) : []),
      ]);
      return;
    }
    if (minOre === null && maxOre === null) {
      this.reportAmountError('Indtast mindst et beløb.', ['minimum', 'maximum']);
      return;
    }
    if (!this.currencies.some((item) => item === currency)) {
      this.reportAmountError('Vælg en valuta for beløbsfilteret.', ['currency']);
      return;
    }
    if (minOre !== null && maxOre !== null && minOre > maxOre) {
      this.reportAmountError('Det mindste beløb må ikke være større end det største.', [
        'minimum',
        'maximum',
      ]);
      return;
    }
    this.amountError.set(null);
    this.amountErrorFields.set([]);
    this.table
      .getColumn('amount')!
      .setFilterValue({ currency, minOre, maxOre } satisfies AmountFilter);
  }

  protected clearAmountFilter(): void {
    this.amountForm.reset({ currency: '', minimum: '', maximum: '' });
    this.amountError.set(null);
    this.amountErrorFields.set([]);
    this.table.getColumn('amount')!.setFilterValue(undefined);
  }

  private reportAmountError(message: string, fields: AmountField[]): void {
    this.amountError.set(message);
    this.amountErrorFields.set(fields);
  }

  protected openPayment(payment: PaymentRecord, event: Event): void {
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.closest(
        'button, a, input, select, textarea, [role="checkbox"], kirby-checkbox, kirby-data-grid-row-checkbox',
      )
    ) {
      return;
    }
    this.returnFocus = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    this.detailId.set(payment.id);
    afterNextRender(() => this.detailsHeading()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }

  protected onRowKeydown(payment: PaymentRecord, event: KeyboardEvent): void {
    if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    this.openPayment(payment, event);
  }

  protected closeDetails(): void {
    this.detailId.set(null);
    if (this.returnFocus?.isConnected) this.returnFocus.focus();
    else this.gridTable()?.nativeElement.focus();
  }
}
