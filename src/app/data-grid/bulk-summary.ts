import { Component, EventEmitter, HostBinding, Input, Output, computed, signal } from '@angular/core';
import { ButtonComponent } from '@kirbydesign/designsystem/button';
import { CheckboxComponent } from '@kirbydesign/designsystem/checkbox';
import { AvatarComponent } from '@kirbydesign/designsystem/avatar';
import { IconComponent } from '@kirbydesign/designsystem/icon';
import { SectionHeaderComponent } from '@kirbydesign/designsystem/section-header';
import { ItemComponent } from '@kirbydesign/designsystem/item';
import { Container } from './table-config';
import { CHECK_COLORS, CHECK_ICONS, Payment, RecipientCheck, accountCurrency, canApprove, convert, formatAmount } from './payments';

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
    CheckboxComponent,
    IconComponent,
    SectionHeaderComponent,
    ItemComponent,
    AvatarComponent,
  ],
  template: `
    <div class="top-row">
      <button kirby-button class="round" attentionLevel="3" title="Skjul" aria-label="Fravælg alle" [showIconOnly]="true" (click)="closed.emit()">
        <kirby-icon name="arrow-more"></kirby-icon>
      </button>
      <h2 class="kirby-text-bold">Godkend</h2>
      <button kirby-button class="round" attentionLevel="3" title="Luk" aria-label="Fravælg alle" [showIconOnly]="true" (click)="closed.emit()">
        <kirby-icon name="close"></kirby-icon>
      </button>
    </div>

    <section class="group">
      <kirby-section-header><h4 heading>Modtagertjek</h4></kirby-section-header>
      <p class="hint">Vælg betalinger uden match for at godkende dem</p>
      <div class="panel-list">
        @for (g of visibleGroups(); track g.key) {
          <kirby-item>
            <kirby-avatar slot="start" size="xs" [class]="g.color">
              <kirby-icon [name]="g.icon"></kirby-icon>
            </kirby-avatar>
            <div class="item-text">
              <div class="kirby-text-normal">{{ g.label }}</div>
              <div class="kirby-text-small muted">{{ counts()[g.key] }} stk. • {{ groupAmount(g.key) }}</div>
            </div>
            <kirby-checkbox
              slot="end"
              size="xs"
              [checked]="checked().has(g.key)"
              (checkedChange)="toggle(g.key, $event)"
              [attr.aria-label]="g.label"
            ></kirby-checkbox>
          </kirby-item>
        }
      </div>
    </section>

    <section class="group">
      <kirby-section-header><h4 heading>I alt</h4></kirby-section-header>
      <div class="panel-list">
        <kirby-item>
          <div class="item-text">
            <div class="kirby-text-normal">{{ payments.length === 1 ? '1 betaling' : payments.length + ' betalinger' }}</div>
            <div class="kirby-text-small muted">Danske kroner • DKK</div>
          </div>
          <span slot="end" class="amount-value">ca. {{ formatAmount(totalDkk()) }}</span>
        </kirby-item>
        @for (r of totals(); track r.key) {
          <kirby-item>
            <kirby-avatar slot="start" size="xs" [text]="'' + r.count"></kirby-avatar>
            <div class="item-text">
              <div class="kirby-text-normal">{{ r.title }}</div>
              <div class="kirby-text-small muted">{{ r.subtitle }}</div>
            </div>
            <span slot="end" class="amount-value">ca. {{ formatAmount(r.converted) }} {{ r.target }}</span>
          </kirby-item>
        }
      </div>
    </section>

    <!-- [OPEN POINT: Stop og menuen har ingen beskrevet funktion endnu; de er kun vist som i designet] -->
    <footer class="actions">
      <button kirby-button attentionLevel="1" [disabled]="approvable().length === 0" (click)="approve.emit(approvable())">
        Godkend {{ approvable().length }}
      </button>
      <button kirby-button class="soft" attentionLevel="3">Stop</button>
      <button kirby-button class="round soft" attentionLevel="3" aria-label="Flere handlinger" [showIconOnly]="true">
        <kirby-icon name="more"></kirby-icon>
      </button>
    </footer>
  `,
  // Fladerne følger tabellens container: hvide kort på kanvas og optegnet kort, kanvasfarvede kort på hævet kort
  styles: `
    :host {
      --panel-surface: var(--kirby-white);
      --panel-divider: var(--kirby-semi-light);
      display: flex;
      flex-direction: column;
      min-height: 100%;
      box-sizing: border-box;
      padding: var(--kirby-spacing-m) var(--kirby-spacing-m) 0;
    }
    :host(.variant-card) {
      --panel-surface: var(--kirby-background-color);
      --panel-divider: var(--kirby-semi-light);
    }
    .top-row {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      margin-bottom: var(--kirby-spacing-m);

      h2 {
        margin: 0;
        text-align: center;
        font-size: var(--kirby-font-size-l);
      }
    }
    .round {
      margin: 0;
      border-radius: var(--kirby-border-radius-circle);
      background-color: var(--panel-surface);
    }
    .group {
      margin-bottom: var(--kirby-spacing-l);

      kirby-section-header {
        margin-bottom: 0;
      }
    }
    .hint {
      margin: 0 0 var(--kirby-spacing-xs);
      padding: 0 var(--kirby-spacing-s);
      font-size: var(--kirby-font-size-s);
      color: var(--kirby-text-color-semi-dark);
    }
    .item-text > div:first-child {
      white-space: nowrap;
    }

    .item-text {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .muted {
      color: var(--kirby-text-color-semi-dark);
    }
    .panel-list {
      background-color: var(--panel-surface);
      border-radius: var(--kirby-border-radius-l);
      overflow: hidden;

      kirby-item {
        --kirby-item-background: transparent;
      }
      kirby-item:not(:last-child) {
        border-bottom: 1px solid var(--panel-divider);
      }
    }
    :host(.variant-stroked-card) .panel-list {
      border: 1px solid var(--kirby-semi-light);
    }
    kirby-avatar {
      --kirby-avatar-color: var(--kirby-black);
      --kirby-avatar-background-color: var(--kirby-semi-light);
      &.success {
        --kirby-avatar-background-color: var(--kirby-success-tint);
      }
      &.warning {
        --kirby-avatar-background-color: var(--kirby-warning-tint);
      }
      &.danger {
        --kirby-avatar-background-color: var(--kirby-danger-tint);
      }
    }
    .amount-value {
      font-weight: var(--kirby-font-weight-bold);
      white-space: nowrap;
    }
    .actions {
      position: sticky;
      bottom: 0;
      display: flex;
      align-items: center;
      gap: var(--kirby-spacing-xs);
      margin: auto calc(-1 * var(--kirby-spacing-m)) 0;
      padding: var(--kirby-spacing-s) var(--kirby-spacing-m);
      background-color: var(--kirby-white);

      button {
        margin: 0;
      }
      .soft {
        background-color: var(--kirby-semi-light);
        color: var(--kirby-black);
      }
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
  @Input() variant: Container = 'canvas';
  @HostBinding('class') get hostClass() {
    return `variant-${this.variant}`;
  }
  @Output() closed = new EventEmitter<void>();
  @Output() approve = new EventEmitter<number[]>();

  readonly formatAmount = formatAmount;
  // Match er markeret som standard
  readonly checked = signal<ReadonlySet<CheckGroupKey>>(new Set<CheckGroupKey>(['match']));

  readonly totalDkk = computed(() => this.list().reduce((sum, p) => sum + convert(p.amount, p.currency, 'DKK'), 0));

  readonly counts = computed(() => {
    const result: Record<CheckGroupKey, number> = { match: 0, close: 0, none: 0, other: 0 };
    for (const p of this.list()) result[groupOf(p)]++;
    return result;
  });

  readonly visibleGroups = computed(() =>
    CHECK_GROUPS.filter((g) => g.key !== 'other' || this.counts().other > 0).map((g) => ({
      ...g,
      color: g.check ? CHECK_COLORS[g.check] : 'semi-light',
      icon: g.check ? CHECK_ICONS[g.check] : 'person-blocked',
    })),
  );

  /** Beløb i gruppens egen valuta, eller omregnet til DKK når gruppen har flere valutaer */
  groupAmount(key: CheckGroupKey): string {
    const items = this.list().filter((p) => groupOf(p) === key);
    const currencies = new Set(items.map((p) => p.currency));
    if (currencies.size === 1) return `${formatAmount(items.reduce((n, p) => n + p.amount, 0))} ${items[0].currency}`;
    return `ca. ${formatAmount(items.reduce((n, p) => n + convert(p.amount, p.currency, 'DKK'), 0))} DKK`;
  }

  readonly approvable = computed(() =>
    this.list()
      .filter((p) => canApprove(p) && this.checked().has(groupOf(p)))
      .map((p) => p.id),
  );

  readonly totals = computed<TotalRow[]>(() => {
    const rows = new Map<string, TotalRow>();
    for (const p of this.list()) {
      const target = accountCurrency(p.fromAccount);
      const row = rows.get(p.fromAccount) ?? {
        key: p.fromAccount,
        title: p.fromAccount,
        subtitle: p.accountOwner,
        currency: target,
        count: 0,
        own: 0,
        converted: 0,
        target,
      };
      row.count++;
      row.converted += convert(p.amount, p.currency, target);
      rows.set(p.fromAccount, row);
    }
    return [...rows.values()]
      .map((r) => ({ ...r, subtitle: [r.subtitle, `${r.count} ${r.count === 1 ? 'betaling' : 'betalinger'}`].join(' · ') }))
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
