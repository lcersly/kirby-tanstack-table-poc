import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  ColumnDef,
  ComposableDataGridComponent,
  DataGridCellComponent,
  DataGridHeaderCellComponent,
  DataGridTableDirective,
  TableFeatures,
} from '@kirbydesign/designsystem/data-grid-composable';

import { PaymentRecord } from './payment-data';

const columns = [
  { accessorKey: 'date', header: 'Dato' },
  { accessorKey: 'recipient', header: 'Modtager' },
  { accessorKey: 'amount', header: 'Beløb' },
  { accessorKey: 'currency', header: 'Valuta' },
  { accessorKey: 'paymentType', header: 'Betalingstype' },
  { accessorKey: 'destinationAccount', header: 'Modtagerkonto' },
  { accessorKey: 'status', header: 'Status' },
] satisfies ColumnDef<TableFeatures, PaymentRecord>[];

@Component({
  selector: 'app-prototype-payment-table',
  imports: [
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
  protected readonly columns = columns;
  protected readonly tableOptions = { enableSorting: false };
}
