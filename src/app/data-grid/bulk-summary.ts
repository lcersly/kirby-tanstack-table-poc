import { SfIconComponent } from './sf-icon';
import { Component, DestroyRef, ElementRef, EventEmitter, HostBinding, Input, Output, computed, inject, signal } from '@angular/core';
import { ButtonComponent } from '@kirbydesign/designsystem/button';
import { CheckboxComponent } from '@kirbydesign/designsystem/checkbox';
import { AvatarComponent } from '@kirbydesign/designsystem/avatar';
import { IconComponent } from '@kirbydesign/designsystem/icon';
import { HeaderComponent, HeaderActionsDirective, HeaderCustomSectionDirective } from '@kirbydesign/designsystem/header';
import { ActionGroupComponent } from '@kirbydesign/designsystem/action-group';
import { SectionHeaderComponent } from '@kirbydesign/designsystem/section-header';
import { ModalController } from '@kirbydesign/designsystem/modal';
import { ItemComponent } from '@kirbydesign/designsystem/item';
import { Container } from './table-config';
import { CHECK_COLORS, CHECK_ICONS, Payment, RecipientCheck, accountCurrency, canApprove, canStop, convert, formatAmount } from './payments';

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
    SfIconComponent,
    ButtonComponent,
    CheckboxComponent,
    IconComponent,
    SectionHeaderComponent,
    HeaderComponent,
    HeaderActionsDirective,
    HeaderCustomSectionDirective,
    ActionGroupComponent,
    ItemComponent,
    AvatarComponent,
  ],
  template: `
    <div class="top-row" [class.scrolled]="scrolled()">
      <button kirby-button class="round icon-only" attentionLevel="3" title="Skjul" aria-label="Skjul summering" [showIconOnly]="true" (click)="collapse.emit()">
        <app-sf-icon name="sidebar-right" [size]="24"></app-sf-icon>
      </button>
      <h2 class="kirby-text-bold">Godkend</h2>
      <button kirby-button class="round icon-only" attentionLevel="3" title="Luk" aria-label="Fravælg alle" [showIconOnly]="true" (click)="closed.emit()">
        <kirby-icon name="close"></kirby-icon>
      </button>
    </div>

    <!-- [OPEN POINT: Stop og menuen har ingen beskrevet funktion endnu; de er kun vist som i designet] -->
    <kirby-header
      class="summary-header single-column"
      [emphasizeActions]="true"
      [title]="included().length === 1 ? '1 betaling i alt' : included().length + ' betalinger i alt'"
      [value]="wholeAmount(totalDkk())"
      valueUnit="DKK"
    >
      @if (hasForeign()) {
        <ng-template kirbyHeaderCustomSection>
          <div class="estimate kirby-text-small">
            <span>Vejledende beregning</span>
            <button type="button" class="info" aria-label="Læs mere om vejledende beregning" (click)="showEstimateInfo()">
              <kirby-icon name="information-decoration"></kirby-icon>
            </button>
          </div>
        </ng-template>
      }
      <ng-template kirbyHeaderActions>
        <kirby-action-group>
          <button kirby-button attentionLevel="1" [disabled]="approvable().length === 0" (click)="approve.emit(approvable())">
            Godkend {{ approvable().length }}
          </button>
          <button kirby-button attentionLevel="3" [disabled]="!stoppable()">Stop</button>
          <button kirby-button attentionLevel="3" aria-label="Flere handlinger" [showIconOnly]="true">
            <kirby-icon name="more"></kirby-icon>
          </button>
        </kirby-action-group>
      </ng-template>
    </kirby-header>

    <section class="group">
      <kirby-section-header><h4 heading>Modtagertjek</h4>
        <span detail>Vælg betalinger uden match for at godkende dem</span></kirby-section-header>
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
      <kirby-section-header><h4 heading>I alt pr. konto</h4></kirby-section-header>
      <div class="panel-list">
        @for (r of totals(); track r.key) {
          <kirby-item>
            <kirby-avatar slot="start" size="xs" [text]="'' + r.count"></kirby-avatar>
            <div class="item-text">
              <div class="kirby-text-normal">{{ r.title }}</div>
              <div class="kirby-text-small muted">{{ r.subtitle }}</div>
            </div>
            <span slot="end" class="amount-value">{{ wholeAmount(r.converted) }}</span>
          </kirby-item>
        } @empty {
          <kirby-item><div class="kirby-text-small muted">Afkryds et modtagertjek for at se totaler pr. konto</div></kirby-item>
        }
      </div>
    </section>

  `,
  // Fladerne følger tabellens container: hvide kort på kanvas og optegnet kort, kanvasfarvede kort på hævet kort
  styles: `
    :host {
      --panel-surface: var(--kirby-white);
      --panel-divider: var(--kirby-color-border-base-quiet, #dadada);
      display: flex;
      flex-direction: column;
      min-height: 100%;
      box-sizing: border-box;
      padding: 0 var(--kirby-spacing-m);
    }
    :host(.variant-card) {
      --panel-surface: var(--kirby-background-color);
      --panel-divider: var(--kirby-color-border-base-quiet, #dadada);
      .panel-list {
        background-color: transparent;
        border: 1px solid var(--kirby-color-border-base-quiet, #dadada);
      }
    }
    // Værktøjslinjen med skjul og luk hæfter sig i toppen af panelets rulleområde
    .top-row {
      position: sticky;
      top: 0;
      z-index: 2;
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      margin: 0 calc(-1 * var(--kirby-spacing-m)) var(--kirby-spacing-xs);
      --toolbar-base: var(--kirby-background-color);
      background-color: var(--toolbar-base);
      min-height: var(--kirby-spacing-xxxl);
      padding: 0 var(--kirby-spacing-s);
      border-bottom: 1px solid transparent;
      transition: background-color 50ms linear;
      &.scrolled {
        background-color: color-mix(in srgb, var(--kirby-black) 1.1%, var(--toolbar-base));
        border-bottom-color: var(--kirby-medium);
        transition-duration: var(--kirby-transition-duration-quick);
      }
      @media (min-width: 768px) {
        min-height: var(--kirby-spacing-xxxxxl);
        padding: 0 var(--kirby-spacing-m);
      }

      h2 {
        margin: 0;
        text-align: center;
        font-size: var(--kirby-font-size-l);
      }
    }
    :host(:is(.variant-card, .variant-stroked-card)) .top-row {
      --toolbar-base: var(--kirby-white);
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
    .estimate {
      display: flex;
      align-items: center;
      color: var(--kirby-text-color-semi-dark);
    }
    .estimate .info {
      display: inline-flex;
      margin: 0 0 0 var(--kirby-spacing-xxs);
      padding: 0;
      border: 0;
      background: none;
      color: inherit;
      cursor: pointer;
    }
    .group {
      margin-bottom: var(--kirby-spacing-l);

      kirby-section-header {
        margin-bottom: 0;
      }
    }
    .item-text > div {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .item-text {
      flex: 1;
      padding-right: var(--kirby-spacing-m);
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .muted {
      color: var(--kirby-text-color-semi-dark);
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
    :host(.variant-stroked-card) .panel-list {
      border: 1px solid var(--kirby-color-border-base-quiet, #dadada);
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
  readonly scrolled = signal(false);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const onScroll = (e: Event) => {
      const target = e.target;
      if (target instanceof HTMLElement && target.contains(this.host.nativeElement)) this.scrolled.set(target.scrollTop > 0);
    };
    document.addEventListener('scroll', onScroll, true);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', onScroll, true));
  }

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
  @Output() collapse = new EventEmitter<void>();
  @Output() approve = new EventEmitter<number[]>();

  private readonly modalController = inject(ModalController);
  readonly formatAmount = formatAmount;
  readonly hasForeign = computed(() => this.included().some((p) => p.currency !== 'DKK'));

  showEstimateInfo() {
    this.modalController.showAlert({
      title: 'Vejledende beregning',
      message:
        'Beregningen af det samlede betalingsbeløb for betalinger i fremmed valuta er vejledende. Det endelige beløb afhænger af valutakursen på tidspunktet for vekslingen.',
      okBtn: 'Luk',
    });
  }

  wholeAmount = (n: number) => Math.round(n).toLocaleString('da-DK');
  // Match er markeret som standard
  readonly checked = signal<ReadonlySet<CheckGroupKey>>(new Set<CheckGroupKey>(['match']));

  /** Kun betalinger i de afkrydsede modtagertjek-grupper indgår i totalerne */
  readonly included = computed(() => this.list().filter((p) => this.checked().has(groupOf(p))));

  readonly totalDkk = computed(() => this.included().reduce((sum, p) => sum + convert(p.amount, p.currency, 'DKK'), 0));

  readonly counts = computed(() => {
    const result: Record<CheckGroupKey, number> = { match: 0, close: 0, none: 0, other: 0 };
    for (const p of this.list()) result[groupOf(p)]++;
    return result;
  });

  readonly visibleGroups = computed(() =>
    CHECK_GROUPS.filter((g) => this.counts()[g.key] > 0).map((g) => ({
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

  readonly approvable = computed(() => this.included().filter(canApprove).map((p) => p.id));
  readonly stoppable = computed(() => this.included().some(canStop));

  readonly totals = computed<TotalRow[]>(() => {
    const rows = new Map<string, TotalRow>();
    for (const p of this.included()) {
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
