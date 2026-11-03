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
  viewChild,
} from '@angular/core';
import { ButtonComponent } from '@kirbydesign/designsystem/button';
import {
  ColumnDef,
  CellContext,
  ComposableDataGridComponent,
  DataGridCellComponent,
  DataGridHeaderCellComponent,
  DataGridTableDirective,
  TableFeatures,
  TableOptions,
  RowData,
  createSortedRowModel,
  stockFeatures,
  tableFeatures,
} from '@kirbydesign/designsystem/data-grid-composable';

import { amountFormatter, dateFormatter, PaymentRecord } from './payment-data';

const collator = new Intl.Collator('da-DK', { numeric: true, sensitivity: 'base' });
const columns = [
  {
    id: 'date',
    accessorKey: 'dateTimestamp',
    header: 'Dato',
    cell: (context: Pick<CellContext<TableFeatures, PaymentRecord, unknown>, 'getValue'>) =>
      dateFormatter.format(context.getValue<number>()),
  },
  { accessorKey: 'recipient', header: 'Modtager' },
  {
    id: 'amount',
    accessorKey: 'amountInOre',
    header: 'Beløb',
    cell: (context: Pick<CellContext<TableFeatures, PaymentRecord, unknown>, 'getValue'>) =>
      amountFormatter.format(context.getValue<number>() / 100),
  },
  { accessorKey: 'currency', header: 'Valuta' },
  { accessorKey: 'paymentType', header: 'Betalingstype' },
  { accessorKey: 'destinationAccount', header: 'Modtagerkonto' },
  { accessorKey: 'status', header: 'Status' },
] satisfies ColumnDef<TableFeatures, PaymentRecord>[];

@Component({
  selector: 'app-prototype-payment-table',
  imports: [
    ButtonComponent,
    ComposableDataGridComponent,
    DataGridCellComponent,
    DataGridHeaderCellComponent,
    DataGridTableDirective,
  ],
  templateUrl: './payment-table.html',
  styleUrl: './payment-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentTablePrototype {
  readonly payments = input.required<PaymentRecord[]>();
  private readonly injector = inject(Injector);
  private readonly grid = viewChild(ComposableDataGridComponent);
  private readonly detailsHeading = viewChild<ElementRef<HTMLElement>>('detailsHeading');
  private readonly paymentsByContext = computed(
    () => new Map<unknown, PaymentRecord>(this.payments().map((payment) => [payment, payment])),
  );
  private returnFocus: HTMLElement | null = null;
  protected readonly columns = columns;
  protected readonly tableOptions = {
    features: tableFeatures({
      ...stockFeatures,
      sortedRowModel: createSortedRowModel(),
    }),
    enableSorting: true,
    enableMultiSort: false,
    sortDescFirst: false,
    defaultColumn: {
      sortFn: (rowA, rowB, columnId) => {
        const a = rowA.getValue<unknown>(columnId);
        const b = rowB.getValue<unknown>(columnId);
        return typeof a === 'number' && typeof b === 'number'
          ? a - b
          : collator.compare(String(a), String(b));
      },
    },
  } satisfies Partial<TableOptions<TableFeatures, RowData>>;

  constructor() {
    effect(() => {
      const grid = this.grid();
      if (grid?.sidePanelOpen() && !this.selectedPayment(grid.sidePanelContext())) {
        grid.closeSidePanel();
      }
    });
  }

  protected selectedPayment(context: unknown): PaymentRecord | undefined {
    return this.paymentsByContext().get(context);
  }

  protected openPayment(payment: PaymentRecord, event: Event): void {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('button, a, input, select, textarea')) {
      return;
    }
    this.returnFocus = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    this.grid()?.openSidePanel(payment);
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
    this.grid()?.closeSidePanel();
    this.returnFocus?.focus();
  }
}
