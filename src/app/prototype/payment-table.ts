import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import {
  ColumnDef,
  FlexRender,
  flexRenderComponent,
  functionalUpdate,
  injectTable,
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
import { PaymentStatusCell } from './payment-status-cell';

const collator = new Intl.Collator('da-DK', { numeric: true, sensitivity: 'base' });
const features = tableFeatures({ rowSortingFeature, rowSelectionFeature });

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

@Component({
  selector: 'app-prototype-payment-table',
  imports: [
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
  protected readonly sortedPayments = computed(() => {
    const payments = this.payments();
    const sort = this.sorting()[0];
    const field = sort ? sortFields[sort.id] : undefined;
    if (!sort || !field) return payments;

    const direction = sort.desc ? -1 : 1;
    return [...payments].sort((a, b) => {
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
  protected readonly sorting = signal<SortingState>([]);
  protected readonly rowSelection = signal<RowSelectionState>({});

  readonly table = injectTable(() => ({
    features,
    columns,
    data: this.sortedPayments(),
    getRowId: (payment) => payment.id,
    manualSorting: true,
    enableMultiSort: false,
    enableSortingRemoval: true,
    sortDescFirst: false,
    state: {
      sorting: this.sorting(),
      rowSelection: this.rowSelection(),
    },
    onSortingChange: (updater) => this.sorting.set(functionalUpdate(updater, this.sorting())),
    onRowSelectionChange: (updater) =>
      this.rowSelection.set(functionalUpdate(updater, this.rowSelection())),
  }));

  constructor() {
    effect(() => {
      this.payments();
      this.rowSelection.set({});
    });
  }
}
