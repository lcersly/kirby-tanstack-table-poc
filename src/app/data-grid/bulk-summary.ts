import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { ButtonComponent } from '@kirbydesign/designsystem/button';
import { CardComponent } from '@kirbydesign/designsystem/card';
import { CheckboxComponent } from '@kirbydesign/designsystem/checkbox';
import { HeaderActionsDirective, HeaderComponent } from '@kirbydesign/designsystem/header';
import { IconComponent } from '@kirbydesign/designsystem/icon';
import { SectionHeaderComponent } from '@kirbydesign/designsystem/section-header';
import { SegmentedControlComponent } from '@kirbydesign/designsystem/segmented-control';
import { CurrencyComponent } from './currency';
import { RecipientCheckComponent } from './recipient-check';
import { Payment, RecipientCheck, accountCurrency, canApprove, convert, formatAmount } from './payments';

type CheckGroupKey = 'match' | 'close' | 'none' | 'other';

const CHECK_GROUPS: { key: CheckGroupKey; label: string; check?: RecipientCheck }[] = [
  { key: 'match', label: 'Match', check: 'Match' },
  { key: 'close', label: 'Tæt match', check: 'Tæt match' },
  { key: 'none', label: 'Intet match', check: 'Intet match' },
  { key: 'other', label: 'Øvrige' },
];

function groupOf(p: Payment): CheckGroupKey {
  return CHECK_GROUPS.find((g) => g.check === p.recipientCheck)?.key ?? 'other';
}

interface TotalRow {
  key: string;
  title: string;
  subtitle?: string;
  currency: string;
  count: number;
  /** Beløb i rækkens egen mønt (kun vist for valuta) */
  own: number;
  /** Beløb omregnet til målmønten */
  converted: number;
  target: string;
}

/** Inline-panel med overblik over de valgte betalinger: antal, ca. beløb, modtagertjek og totaler. */
@Component({
  selector: 'app-bulk-summary',
  imports: [
    ButtonComponent,
    CardComponent,
    CheckboxComponent,
    CurrencyComponent,
    HeaderActionsDirective,
    HeaderComponent,
    IconComponent,
    RecipientCheckComponent,
    SectionHeaderComponent,
    SegmentedControlComponent,
  ],
  template: `
    <div class="top-row">
      <button kirby-button class="dismiss" attentionLevel="3" title="Luk" aria-label="Fravælg alle" (click)="closed.emit()">
        <kirby-icon name="close"></kirby-icon>
      </button>
    </div>
    <kirby-header
      class="single-column"
      [title]="payments.length === 1 ? '1 valgt betaling' : payments.length + ' valgte betalinger'"
      [value]="'ca. ' + formatAmount(totalDkk())"
      valueUnit="DKK"
      subtitle1="Omregnet til DKK"
      [emphasizeActions]="true"
    >
      <ng-template kirbyHeaderActions>
        <button kirby-button attentionLevel="1" [disabled]="approvable().length === 0" (click)="approve.emit(approvable())">
          Godkend {{ approvable().length }}
        </button>
      </ng-template>
    </kirby-header>

    <section class="group">
      <kirby-section-header>
        <h3 heading>Modtagertjek</h3>
<span label>Vælg, hvilke betalinger der godkendes</span>
      </kirby-section-header>
      <kirby-card variant="outlined" class="outlined">
        <ul class="check-list">
          @for (g of visibleGroups(); track g.key) {
            <li>
              <kirby-checkbox
                size="xs"
                [checked]="checked().has(g.key)"
                (checkedChange)="toggle(g.key, $event)"
                [attr.aria-label]="g.label"
              ></kirby-checkbox>
              <span class="label">
                @if (g.check) {
                  <app-recipient-check [check]="g.check"></app-recipient-check>
                } @else {
                  {{ g.label }}
                }
              </span>
              <span class="count">{{ counts()[g.key] }}</span>
            </li>
          }
        </ul>
      </kirby-card>
    </section>

    <section class="group">
      <kirby-section-header>
        <h3 heading>Totaler</h3>
<span label>Omregnet til DKK eller kontoens bogføringsmønt</span>
      </kirby-section-header>
      <kirby-segmented-control
        [items]="views"
        [selectedIndex]="view()"
        (selectedIndexChange)="view.set($event)"
      ></kirby-segmented-control>
      <kirby-card variant="outlined" class="outlined totals">
        <ul class="total-list">
          @for (r of totals(); track r.key) {
            <li>
              <div class="left">
                @if (view() === 1) {
                  <app-currency [code]="r.currency" [flagSize]="'xs'"></app-currency>
                } @else {
                  <span class="kirby-text-small-bold">{{ r.title }}</span>
                }
                <span class="kirby-text-xsmall muted">{{ r.subtitle }}</span>
              </div>
              <div class="right">
                @if (view() === 1 && r.currency !== r.target) {
                  <span class="kirby-text-small muted">{{ formatAmount(r.own) }} {{ r.currency }}</span>
                }
                <span class="kirby-text-small-bold">ca. {{ formatAmount(r.converted) }} {{ r.target }}</span>
              </div>
            </li>
          }
        </ul>
      </kirby-card>
    </section>
  `,
  styles: `
    :host {
      display: block;
      padding: var(--kirby-spacing-m);
    }
    .top-row {
      display: flex;
      justify-content: flex-end;
      min-height: 32px;
    }
    .dismiss {
      margin: 0;
    }
    kirby-header {
      margin-bottom: var(--kirby-spacing-s);
    }
    .group {
      margin-bottom: var(--kirby-spacing-l);

      kirby-section-header {
        margin-bottom: 0;
      }
      kirby-segmented-control {
        display: block;
        margin-bottom: var(--kirby-spacing-s);
      }
    }
    .outlined {
      display: block;
      padding: 0;
      background: transparent;
      box-shadow: none;
      --kirby-card-border: 1px solid var(--divider-color, var(--kirby-semi-light));
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    li {
      display: flex;
      align-items: center;
      gap: var(--kirby-spacing-s);
      padding: var(--kirby-spacing-s) var(--kirby-spacing-m);
      border-bottom: 1px solid var(--divider-color, var(--kirby-semi-light));

      &:last-child {
        border-bottom: none;
      }
    }
    .label {
      flex: 1;
    }
    .count {
      font-weight: var(--kirby-font-weight-bold);
    }
    .total-list li {
      justify-content: space-between;
      align-items: flex-start;
    }
    .left,
    .right {
      display: flex;
      flex-direction: column;
      gap: var(--kirby-spacing-xxxs);
    }
    .right {
      align-items: flex-end;
      text-align: right;
    }
    .muted {
      color: var(--kirby-text-color-semi-dark);
    }
  `,
})
export class BulkSummaryComponent {
  private readonly list = signal<Payment[]>([]);

  @Input({ required: true }) set payments(v: Payment[]) {
    this.list.set(v);
  }
  get payments(): Payment[] {
    return this.list();
  }
  @Output() closed = new EventEmitter<void>();
  @Output() approve = new EventEmitter<number[]>();

  readonly formatAmount = formatAmount;
  readonly views = [
    { id: 'account', text: 'Pr. konto' },
    { id: 'currency', text: 'Pr. valuta' },
  ];
  readonly view = signal(0); // 0 = pr. konto, 1 = pr. valuta
  // Match er markeret som standard
  readonly checked = signal<ReadonlySet<CheckGroupKey>>(new Set<CheckGroupKey>(['match']));

  readonly totalDkk = computed(() => this.list().reduce((sum, p) => sum + convert(p.amount, p.currency, 'DKK'), 0));

  readonly counts = computed(() => {
    const result: Record<CheckGroupKey, number> = { match: 0, close: 0, none: 0, other: 0 };
    for (const p of this.list()) result[groupOf(p)]++;
    return result;
  });

  readonly visibleGroups = computed(() => CHECK_GROUPS.filter((g) => g.key !== 'other' || this.counts().other > 0));

  readonly approvable = computed(() =>
    this.list()
      .filter((p) => canApprove(p) && this.checked().has(groupOf(p)))
      .map((p) => p.id),
  );

  readonly totals = computed<TotalRow[]>(() => {
    const byCurrency = this.view() === 1;
    const rows = new Map<string, TotalRow>();
    for (const p of this.list()) {
      const key = byCurrency ? p.currency : p.fromAccount;
      const target = byCurrency ? 'DKK' : accountCurrency(p.fromAccount);
      const row = rows.get(key) ?? {
        key,
        title: byCurrency ? p.currency : p.fromAccount,
        subtitle: '',
        currency: byCurrency ? p.currency : target,
        count: 0,
        own: 0,
        converted: 0,
        target,
      };
      row.count++;
      row.own += p.amount;
      row.converted += convert(p.amount, p.currency, target);
      if (!byCurrency) row.subtitle = p.accountOwner;
      rows.set(key, row);
    }
    return [...rows.values()]
      .map((r) => ({ ...r, subtitle: [r.subtitle, `${r.count} ${r.count === 1 ? 'betaling' : 'betalinger'}`].filter(Boolean).join(' · ') }))
      .sort((a, b) => b.converted - a.converted);
  });

  toggle(key: CheckGroupKey, on: boolean) {
    this.checked.update((s) => {
      const next = new Set(s);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }
}
