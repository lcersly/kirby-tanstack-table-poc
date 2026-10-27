import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FlexRender, injectTable, tableFeatures } from '@tanstack/angular-table';

import { PaymentRecord } from './payment-data';

const features = tableFeatures({});
const columns = [
  { accessorKey: 'date', header: 'Dato' },
  { accessorKey: 'recipient', header: 'Modtager' },
  { accessorKey: 'amount', header: 'Beløb' },
  { accessorKey: 'currency', header: 'Valuta' },
  { accessorKey: 'paymentType', header: 'Betalingstype' },
  { accessorKey: 'destinationAccount', header: 'Modtagerkonto' },
  { accessorKey: 'status', header: 'Status' },
];

@Component({
  selector: 'app-prototype-payment-table',
  imports: [FlexRender],
  templateUrl: './payment-table.html',
  styleUrl: './payment-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentTablePrototype {
  readonly payments = input.required<PaymentRecord[]>();
  protected readonly table = injectTable(() => ({
    features,
    columns,
    data: this.payments(),
  }));
}
