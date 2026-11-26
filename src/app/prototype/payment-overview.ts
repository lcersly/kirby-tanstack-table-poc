import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ButtonComponent } from '@kirbydesign/designsystem/button';
import { InputComponent } from '@kirbydesign/designsystem/form-field';
import { AccordionDirective, AccordionItemComponent } from '@kirbydesign/designsystem/accordion';

import { DEMO_COMMIT, KIRBY_VERSION } from './demo-commit.generated';
import { createSyntheticPayments } from './payment-data';
import { PaymentTablePrototype } from './payment-table';

@Component({
  selector: 'app-payment-overview-prototype',
  imports: [
    ButtonComponent,
    InputComponent,
    AccordionDirective,
    AccordionItemComponent,
    PaymentTablePrototype,
  ],
  templateUrl: './payment-overview.html',
  styleUrl: './payment-overview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentOverviewPrototype {
  protected readonly demoCommit = DEMO_COMMIT;
  protected readonly kirbyVersion = KIRBY_VERSION;
  protected readonly requestedCount = signal('1000');
  protected readonly countError = signal<string | null>(null);
  protected readonly payments = signal(createSyntheticPayments(1_000));

  protected updateRequestedCount(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.requestedCount.set(target.value);
      this.countError.set(null);
    }
  }

  protected generate(): void {
    const value = this.requestedCount().trim();
    const count = Number(value);

    if (!/^\d+$/.test(value) || !Number.isSafeInteger(count)) {
      this.countError.set('Indtast et helt tal mellem 0 og 100.000.');
      return;
    }

    if (count < 0 || count > 100_000) {
      this.countError.set('Vælg mellem 0 og 100.000 betalinger.');
      return;
    }

    this.payments.set(createSyntheticPayments(count));
    this.countError.set(null);
  }
}
