import { SfIconComponent } from './sf-icon';
import { Component, HostBinding, computed, input, output } from '@angular/core';
import { ActionGroupComponent } from '@kirbydesign/designsystem/action-group';
import { AvatarComponent } from '@kirbydesign/designsystem/avatar';
import { ButtonComponent } from '@kirbydesign/designsystem/button';
import { HeaderComponent, HeaderActionsDirective } from '@kirbydesign/designsystem/header';
import { IconComponent } from '@kirbydesign/designsystem/icon';
import { ItemComponent } from '@kirbydesign/designsystem/item';
import { SectionHeaderComponent } from '@kirbydesign/designsystem/section-header';
import { formatAmount, formatDate } from './payments';
import { Container } from './table-config';
import { Transaction } from './transactions';

/** Sidepanel med summen af de valgte kontobevægelser. */
@Component({
  selector: 'app-transactions-summary',
  imports: [
    SfIconComponent,
    ActionGroupComponent,
    AvatarComponent,
    ButtonComponent,
    HeaderActionsDirective,
    HeaderComponent,
    IconComponent,
    ItemComponent,
    SectionHeaderComponent,
  ],
  template: `
    <div class="top-row">
      <button kirby-button class="round icon-only" attentionLevel="3" title="Skjul" aria-label="Skjul summering" [showIconOnly]="true" (click)="collapse.emit()">
        <app-sf-icon name="sidebar-right" [size]="24"></app-sf-icon>
      </button>
      <button kirby-button class="round icon-only" attentionLevel="3" title="Luk" aria-label="Fravælg alle" [showIconOnly]="true" (click)="closed.emit()">
        <kirby-icon name="close"></kirby-icon>
      </button>
    </div>

    <!-- [OPEN POINT: Eksporter og Afstem har ingen beskrevet funktion endnu; de er kun vist i designet] -->
    <kirby-header
      class="summary-header single-column"
      [emphasizeActions]="true"
      [title]="transactions().length === 1 ? '1 postering' : transactions().length + ' posteringer'"
      [value]="amount(total())"
      [valueUnit]="currency()"
      [subtitle1]="period()"
    >
      <ng-template kirbyHeaderActions>
        <kirby-action-group>
          <button kirby-button attentionLevel="3">Eksporter</button>
          <button kirby-button attentionLevel="1">Afstem</button>
        </kirby-action-group>
      </ng-template>
    </kirby-header>

    <section class="group">
      <kirby-section-header><h4 heading>Ind og ud</h4></kirby-section-header>
      <div class="panel-list">
        @for (r of flows(); track r.title) {
          <kirby-item>
            <kirby-avatar slot="start" size="xs" [text]="'' + r.count"></kirby-avatar>
            <div class="item-text">
              <div class="kirby-text-normal">{{ r.title }}</div>
            </div>
            <span slot="end" class="amount-value">{{ amount(r.sum) }}</span>
          </kirby-item>
        }
      </div>
    </section>

    <section class="group">
      <kirby-section-header><h4 heading>Status</h4></kirby-section-header>
      <div class="panel-list">
        @for (r of statuses(); track r.title) {
          <kirby-item>
            <kirby-avatar slot="start" size="xs" [text]="'' + r.count"></kirby-avatar>
            <div class="item-text">
              <div class="kirby-text-normal">{{ r.title }}</div>
            </div>
            <span slot="end" class="amount-value">{{ amount(r.sum) }}</span>
          </kirby-item>
        }
      </div>
    </section>
  `,
  styles: `
    :host {
      --panel-surface: var(--kirby-white);
      --panel-divider: var(--kirby-color-border-base-quiet, #dadada);
      display: flex;
      flex-direction: column;
      min-height: 100%;
      box-sizing: border-box;
      padding: var(--kirby-spacing-m);
    }
    :host(.variant-card) {
      --panel-surface: var(--kirby-background-color);
      --panel-divider: var(--kirby-color-border-base-quiet, #dadada);
      .panel-list {
        background-color: transparent;
        border: 1px solid var(--kirby-color-border-base-quiet, #dadada);
      }
    }
    :host(.variant-stroked-card) .panel-list {
      border: 1px solid var(--kirby-color-border-base-quiet, #dadada);
    }
    .top-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: var(--kirby-spacing-s);
    }
    .round app-sf-icon {
      width: 24px;
      height: 24px;
      scale: 1 !important;
      margin: 0 !important;
    }
    .round {
      margin: 0;
      border-radius: var(--kirby-border-radius-circle);
      background-color: var(--panel-surface);
    }
    .summary-header {
      display: block;
      margin-bottom: var(--kirby-spacing-l);
    }
    .summary-header ::ng-deep .subtitle {
      color: var(--kirby-text-color-semi-dark);
    }
    .group {
      margin-bottom: var(--kirby-spacing-l);

      kirby-section-header {
        margin-bottom: 0;
      }
    }
    .item-text {
      flex: 1;
      min-width: 0;
      padding-right: var(--kirby-spacing-m);
    }
    .panel-list {
      background-color: var(--panel-surface);
      border-radius: var(--kirby-border-radius-n);
      overflow: hidden;

      kirby-item {
        --kirby-item-background: transparent;
      }
      kirby-item:not(:last-child) {
        border-bottom: 1px solid var(--panel-divider);
      }
    }
    kirby-avatar {
      --kirby-avatar-color: var(--kirby-black);
      --kirby-avatar-background-color: var(--kirby-semi-light);
    }
    .amount-value {
      font-weight: var(--kirby-font-weight-bold);
      white-space: nowrap;
    }
  `,
})
export class TransactionsSummaryComponent {
  readonly transactions = input.required<Transaction[]>();
  readonly variant = input<Container>('canvas');
  readonly closed = output<void>();
  readonly collapse = output<void>();

  @HostBinding('class') get hostClass() {
    return `variant-${this.variant()}`;
  }

  readonly amount = (n: number) => formatAmount(n);
  readonly currency = computed(() => this.transactions()[0]?.currency ?? '');
  readonly total = computed(() => this.sum(this.transactions()));

  readonly period = computed(() => {
    const dates = this.transactions().map((t) => t.date).sort();
    if (!dates.length) return null;
    const [from, to] = [dates[0], dates[dates.length - 1]];
    return from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`;
  });

  readonly flows = computed(() => [
    this.row('Indbetalinger', (t) => t.amount > 0),
    this.row('Udbetalinger', (t) => t.amount < 0),
  ]);

  readonly statuses = computed(() => [
    this.row('Bogført', (t) => t.status === 'Bogført'),
    this.row('Afventer', (t) => t.status === 'Afventer'),
  ]);

  private sum(list: Transaction[]) {
    return list.reduce((n, t) => n + t.amount, 0);
  }

  private row(title: string, test: (t: Transaction) => boolean) {
    const list = this.transactions().filter(test);
    return { title, count: list.length, sum: this.sum(list) };
  }
}
