import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
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

import { amountFormatter, dateFormatter, PaymentRecord } from './payment-data';
import { AmountFilter, PaymentAmountFilter } from './payment-amount-filter';
import { PaymentStatusCell } from './payment-status-cell';

const collator = new Intl.Collator('da-DK', { numeric: true, sensitivity: 'base' });
const features = tableFeatures({ rowSortingFeature, columnFilteringFeature, rowSelectionFeature });

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
    PaymentAmountFilter,
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
  protected readonly statusItems = statusItems;
  protected readonly activeAmountFilter = computed(() => {
    const value = this.columnFilters().find((filter) => filter.id === 'amount')?.value;
    return isAmountFilter(value) ? value : null;
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
    });
  }

  protected onStatusSelect(item: SegmentItem): void {
    this.table.getColumn('status')?.setFilterValue(item.id === ALL_STATUSES ? undefined : item.id);
  }

  protected setAmountFilter(filter: AmountFilter | null): void {
    this.table.getColumn('amount')!.setFilterValue(filter ?? undefined);
  }
}
