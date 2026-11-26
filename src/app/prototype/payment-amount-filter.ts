import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent } from '@kirbydesign/designsystem/button';
import { DropdownComponent } from '@kirbydesign/designsystem/dropdown';
import { FormFieldComponent, InputComponent } from '@kirbydesign/designsystem/form-field';

import { PAYMENT_CURRENCIES } from './payment-data';

export interface AmountFilter {
  currency: string;
  minOre: number | null;
  maxOre: number | null;
}

type AmountField = 'currency' | 'minimum' | 'maximum';

const integerFormatter = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 });

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

@Component({
  selector: 'app-payment-amount-filter',
  imports: [ButtonComponent, DropdownComponent, FormFieldComponent, InputComponent, ReactiveFormsModule],
  templateUrl: './payment-amount-filter.html',
  styleUrl: './payment-amount-filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentAmountFilter {
  readonly activeFilter = input.required<AmountFilter | null>();
  readonly filterChange = output<AmountFilter | null>();

  protected readonly currencies: string[] = [...PAYMENT_CURRENCIES];
  protected readonly amountForm = new FormGroup({
    currency: new FormControl('', { nonNullable: true }),
    minimum: new FormControl('', { nonNullable: true }),
    maximum: new FormControl('', { nonNullable: true }),
  });
  protected readonly amountError = signal<string | null>(null);
  protected readonly amountErrorFields = signal<AmountField[]>([]);
  protected readonly amountFilterSummary = computed(() => {
    const filter = this.activeFilter();
    if (!filter) return null;
    const min = filter.minOre === null ? null : formatAmount(filter.minOre);
    const max = filter.maxOre === null ? null : formatAmount(filter.maxOre);
    if (min !== null && max !== null) return `${min} - ${max} ${filter.currency}`;
    return min !== null ? `Fra ${min} ${filter.currency}` : `Til ${max} ${filter.currency}`;
  });

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
    this.filterChange.emit({ currency, minOre, maxOre });
  }

  protected clearAmountFilter(): void {
    this.amountForm.reset({ currency: '', minimum: '', maximum: '' });
    this.amountError.set(null);
    this.amountErrorFields.set([]);
    this.filterChange.emit(null);
  }

  private reportAmountError(message: string, fields: AmountField[]): void {
    this.amountError.set(message);
    this.amountErrorFields.set(fields);
  }
}
