import { Component, HostBinding, computed, input, output } from '@angular/core';
import { ButtonComponent } from '@kirbydesign/designsystem/button';
import { FlagComponent } from '@kirbydesign/designsystem/flag';
import { HeaderComponent } from '@kirbydesign/designsystem/header';
import { IconComponent } from '@kirbydesign/designsystem/icon';
import { SectionHeaderComponent } from '@kirbydesign/designsystem/section-header';
import { formatAmount, formatDate } from './payments';
import { Container } from './table-config';
import { TRANSACTION_STATUS_COLORS, Transaction } from './transactions';

/** Sidepanel med detaljer for én kontobevægelse. */
@Component({
  selector: 'app-transaction-detail',
  imports: [ButtonComponent, FlagComponent, HeaderComponent, IconComponent, SectionHeaderComponent],
  template: `
    <div class="top-row">
      <button kirby-button attentionLevel="3" title="Luk" aria-label="Luk detaljer" (click)="closed.emit()">
        <kirby-icon name="close"></kirby-icon>
      </button>
    </div>

    <kirby-header
      class="single-column"
      [title]="transaction().text"
      [value]="amount(transaction().amount)"
      [valueUnit]="transaction().currency"
      [subtitle1]="formatDate(transaction().date)"
    >
      <kirby-flag size="xs" [themeColor]="statusColor[transaction().status]">{{ transaction().status }}</kirby-flag>
    </kirby-header>

    <section class="group">
      <kirby-section-header><h4 heading>Postering</h4></kirby-section-header>
      <dl class="group-card">
        @for (row of rows(); track row.label) {
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        }
      </dl>
    </section>
  `,
  styles: `
    :host {
      --panel-surface: var(--kirby-white);
      display: block;
      padding: var(--kirby-spacing-m);
      box-sizing: border-box;
    }
    :host(.variant-card) {
      --panel-surface: var(--kirby-background-color);
    }
    :host(.variant-stroked-card) .group-card {
      border: 1px solid var(--kirby-color-border-base-quiet, #dadada);
    }
    :host(.variant-card) .group-card {
      border: 1px solid var(--kirby-color-border-base-quiet, #dadada);
    }
    :host(.variant-card) .group-card {
      background-color: transparent;
    }
    .top-row {
      display: flex;
      justify-content: flex-end;
      min-height: 32px;
    }
    .top-row button {
      margin: 0;
    }
    .group {
      margin-bottom: var(--kirby-spacing-l);

      kirby-section-header {
        margin-bottom: 0;
      }
    }
    .group-card {
      margin: 0;
      padding: var(--kirby-spacing-s) var(--kirby-spacing-m);
      background-color: var(--panel-surface);
      border-radius: var(--kirby-border-radius-n);
    }
    dt {
      margin-top: var(--kirby-spacing-s);
      color: var(--kirby-text-color-semi-dark);
      font-size: var(--kirby-font-size-xs);
    }
    dt:first-child {
      margin-top: 0;
    }
    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
  `,
})
export class TransactionDetailComponent {
  readonly transaction = input.required<Transaction>();
  readonly variant = input<Container>('canvas');
  readonly closed = output<void>();

  @HostBinding('class') get hostClass() {
    return `variant-${this.variant()}`;
  }

  readonly statusColor = TRANSACTION_STATUS_COLORS;
  readonly amount = (n: number) => formatAmount(n);
  readonly formatDate = formatDate;

  readonly rows = computed(() => {
    const t = this.transaction();
    return [
      { label: 'Dato', value: formatDate(t.date) },
      { label: 'Valørdato', value: formatDate(t.valueDate) },
      { label: 'Posteringstekst', value: t.text },
      { label: 'Saldo efter postering', value: `${formatAmount(t.balance)} ${t.currency}` },
      { label: 'Bilagsreference', value: t.reference },
      { label: 'Modtagertjek', value: t.recipientCheck ?? 'Ikke relevant' },
      { label: 'Bilag', value: t.hasAttachment ? 'Ja' : 'Ingen' },
    ];
  });
}
