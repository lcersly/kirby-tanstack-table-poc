import { signal, Component, DestroyRef, ElementRef, EventEmitter, HostBinding, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { CardComponent, CardHeaderComponent } from '@kirbydesign/designsystem/card';
import { CheckboxComponent } from '@kirbydesign/designsystem/checkbox';
import { ButtonComponent, ButtonSize } from '@kirbydesign/designsystem/button';
import { HeaderComponent, HeaderActionsDirective } from '@kirbydesign/designsystem/header';
import { SectionHeaderComponent } from '@kirbydesign/designsystem/section-header';
import { FlagComponent } from '@kirbydesign/designsystem/flag';
import { IconComponent } from '@kirbydesign/designsystem/icon';
import { ItemComponent } from '@kirbydesign/designsystem/item';
import { ListComponent, ListItemTemplateDirective } from '@kirbydesign/designsystem/list';
import { MenuComponent } from '@kirbydesign/designsystem/menu';
import { COMPONENT_PROPS, ModalController } from '@kirbydesign/designsystem/modal';
import { PageTitleComponent } from '@kirbydesign/designsystem/page';
import {
  CHECK_COLORS,
  CHECK_ICONS,
  CHECK_TEXTS,
  STATUS_COLORS,
  STATUS_NEEDS_ATTENTION,
  canApprove,
  canEdit,
  canStop,
  formatAmount,
  formatDate,
  paymentDetails,
  Payee,
  Payment,
  PaymentStatus,
  RecipientCheck,
  worstCheck,
} from './payments';
import { PaymentsService } from './payments.service';
import { PayeeCheckDialogComponent } from './payee-check-dialog';
import { Container, Density, TableConfigService } from './table-config';

/** panel = inline eller sidepanel, modal = Kirby-modal, page = egen side (headeren ligger i Kirby-siden) */
export type DetailPresentation = 'panel' | 'modal' | 'page';

/** Detaljevisning af en betaling. Grupperne vises som kort, der følger tabellens ramme (canvas, hævet eller optegnet kort). */
const CHECK_ORDER: RecipientCheck[] = ['Match', 'Tæt match', 'Ikke muligt', 'Anden udbyder', 'Modtagertjek fravalgt', 'Intet match'];

const MODAL_HEIGHTS: Record<RecipientCheck, string> = {
  Match: '450px',
  'Tæt match': '580px',
  'Intet match': '690px',
  'Ikke muligt': '450px',
  'Anden udbyder': '450px',
  'Modtagertjek fravalgt': '430px',
};

@Component({
  selector: 'app-payment-detail',
  imports: [
    CardComponent,
    CardHeaderComponent,
    CheckboxComponent,
    HeaderActionsDirective,
    HeaderComponent,
    SectionHeaderComponent,
    ButtonComponent,
    FlagComponent,
    IconComponent,
    ItemComponent,
    ListComponent,
    ListItemTemplateDirective,
    MenuComponent,
    PageTitleComponent,
  ],
  template: `
    @if (payment(); as p) {
      @if (presentation === 'modal') {
        <kirby-page-title>Betaling</kirby-page-title>
      }
      @if (presentation !== 'page') {
          @if (presentation === 'panel') {
            <div class="toolbar" [class.scrolled]="scrolled()">
              <span class="toolbar-title kirby-text-bold" [class.visible]="titleHidden()">{{ p.recipient }}</span>
              <button
                kirby-button
                class="dismiss"
                attentionLevel="3"
                title="Luk"
                aria-label="Luk detaljer"
                (click)="close()"
              >
                <kirby-icon name="close"></kirby-icon>
              </button>
            </div>
          }
        <header>
          <kirby-header
            class="single-column"
            [title]="p.recipient"
            [value]="formatAmount(p.amount)"
            [valueUnit]="p.currency"
            [subtitle1]="needsAttention(p.status) ? undefined : p.status"
            [emphasizeActions]="true"
          >
            @if (needsAttention(p.status)) {
              <kirby-flag size="xs" [themeColor]="statusColor[p.status]">{{ p.status }}</kirby-flag>
            }
            <ng-template kirbyHeaderActions>
              <div class="header-actions">
                <button kirby-button attentionLevel="1" [disabled]="!canApproveSelected(p)" (click)="service.approve(p)">
                  Godkend
                </button>
                <kirby-menu [buttonSize]="ButtonSize.MD" placement="bottom-start" aria-label="Flere handlinger">
                  <kirby-item [disabled]="!canStop(p)" (click)="canStop(p) && service.stop(p)">Stop</kirby-item>
                  <kirby-item [disabled]="!canEdit(p)">Rediger</kirby-item>
                </kirby-menu>
              </div>
            </ng-template>
          </kirby-header>
        </header>
      }

      @if (p.note) {
        <section class="group">
          <kirby-card class="note-card" [class.outlined]="outlined">
            <kirby-card-header flagged="warning" title="Bemærkning"></kirby-card-header>
            <p class="note-text">{{ p.note }}</p>
          </kirby-card>
        </section>
      }

      <section class="group">
        <div class="group-card approvers">
          <kirby-item [selectable]="true" disclosure="arrow-more">
            <div class="kirby-text-normal">Mulige godkendere</div>
            <kirby-flag slot="end" size="xs" themeColor="semi-light">{{ details().approverCount }}</kirby-flag>
          </kirby-item>
        </div>
      </section>

      @if (p.payees) {
        <section class="group">
          <kirby-section-header>
            <h4 heading>Modtagertjek</h4>
            <span detail>Vælg for at godkende</span>
            <kirby-checkbox
              slot="end"
              size="xs"
              [checked]="allChecked(p)"
              [indeterminate]="someChecked(p)"
              (checkedChange)="toggleAll(p, $event)"
              aria-label="Vælg alle svar"
            ></kirby-checkbox>
          </kirby-section-header>
          <div class="group-card check-groups">
            @for (g of checkGroups(p); track g.check) {
              <kirby-item>
                <span slot="start" class="match-icon" [class]="checkColor[g.check]">
                  <kirby-icon [name]="checkIcon[g.check]"></kirby-icon>
                </span>
                <div class="payee-text">
                  <div class="kirby-text-normal">{{ g.check }}</div>
                  <div class="payee-detail">{{ g.count }} {{ g.count === 1 ? 'modtager' : 'modtagere' }} • {{ formatAmount(g.amount) }}</div>
                </div>
                <kirby-checkbox
                  slot="end"
                  size="xs"
                  [checked]="!deselected().has(g.check)"
                  (checkedChange)="toggleCheck(g.check, $event)"
                  [attr.aria-label]="g.check"
                ></kirby-checkbox>
              </kirby-item>
            }
          </div>
        </section>
      } @else {
      <section class="group">
        <kirby-card
          class="match"
          [class.outlined]="outlined"
          [class.clickable]="!p.payees"
          [attr.role]="p.payees ? null : 'button'"
          [attr.tabindex]="p.payees ? null : 0"
          (click)="!p.payees && openCheck(p)"
          (keydown.enter)="!p.payees && openCheck(p)"
        >
          <kirby-card-header [flagged]="flagLevel(shownCheck(p))" [title]="shownCheck(p)"></kirby-card-header>
          <div class="match-body">
            <span class="match-icon" [class]="checkColor[shownCheck(p)]">
              <kirby-icon [name]="checkIcon[shownCheck(p)]"></kirby-icon>
            </span>
            <span class="match-text">{{ p.payees ? payeeText : checkText[shownCheck(p)] }}</span>
            <button kirby-button size="sm" attentionLevel="3">Læs mere</button>
          </div>
        </kirby-card>
      </section>
      }

      @if (visiblePayees(p); as payees) {
        <section class="group">
          <kirby-section-header><h4 heading>{{ payees.length }} lønmodtagere</h4></kirby-section-header>
          <kirby-list class="group-card payees" [items]="payees" [showDivider]="true" (itemSelect)="openPayee($event)">
            <ng-template kirbyListItemTemplate let-payee>
              <div class="payee-row" [class.removing]="removing().has(payee.number)">
              <kirby-item>
                <span slot="start" class="match-icon" [class]="payeeColor(payee)">
                  <kirby-icon [name]="payeeIcon(payee)"></kirby-icon>
                </span>
                <div class="payee-text">
                  <div class="kirby-text-normal">{{ payeeLabel(payee) }}</div>
                  <div class="payee-detail">Til konto {{ payee.toAccount }}</div>
                </div>
                <div slot="end" class="payee-amount">{{ formatAmount(payee.amount) }} DKK</div>
                <button
                  slot="end"
                  kirby-button
                  attentionLevel="3"
                  title="Fjern lønmodtager"
                  aria-label="Fjern lønmodtager"
                  (click)="$event.stopPropagation(); removePayee(payee)"
                >
                  <kirby-icon name="trash"></kirby-icon>
                </button>
              </kirby-item>
              </div>
            </ng-template>
          </kirby-list>
        </section>
      }

      <section class="group">
        <kirby-section-header><h4 heading>Modtager</h4></kirby-section-header>
        <dl class="group-card">
          @for (row of details().receiver; track row.label) {
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          }
        </dl>
      </section>

      <section class="group">
        <kirby-section-header><h4 heading>Afsender</h4></kirby-section-header>
        <dl class="group-card">
          @for (row of details().sender; track row.label) {
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          }
        </dl>
      </section>

      <section class="group">
        <kirby-section-header><h4 heading>Betaling</h4></kirby-section-header>
        <dl class="group-card">
          @for (row of details().payment; track row.label) {
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          }
        </dl>
      </section>

      <section class="group">
        <kirby-section-header><h4 heading>Aktiviteter</h4></kirby-section-header>
        <ul class="group-card activities">
          @for (a of details().activities; track a.title) {
            <li>
              <div>{{ a.title }}</div>
              <div class="kirby-text-small muted">{{ formatDate(a.date) }} · {{ a.by }}</div>
            </li>
          }
        </ul>
      </section>
    }
  `,
  styles: `
    :host {
      --toolbar-base: var(--kirby-background-color);
      display: block;
      background-color: var(--kirby-background-color);
    }
        // Tabel i hævet kort: detaljerne har kortets farve, og grupperne har canvas-farven uden elevation
    // Tabel på kort: detaljerne er hvide, og alle kort er optegnede (outlined)
    :host(:is(.variant-card, .variant-stroked-card):not(.modal)) {
      --toolbar-base: var(--kirby-white);
      background-color: var(--kirby-white);

      --kirby-card-border: 1px solid var(--kirby-color-border-base-quiet, #dadada);
      .group-card {
        background-color: transparent;
        box-shadow: none;
        border: 1px solid var(--kirby-color-border-base-quiet, #dadada);
      }
    }
    .note-text {
      margin: 0;
      padding: var(--kirby-spacing-s) var(--kirby-spacing-m);
    }
    :host(:not(.page)) {
      box-sizing: border-box;
      padding: 0 var(--kirby-spacing-m) var(--kirby-spacing-xxl);
    }
    :host(.modal) {
      padding-top: var(--kirby-spacing-m);
    }
    header {
      margin-bottom: var(--kirby-spacing-s);
    }
    // Værktøjslinjen hæfter sig i toppen af panelets rulleområde; modtagerens navn rykker op i den, når headeren er ude af syne
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--kirby-spacing-s);
      margin: 0 calc(-1 * var(--kirby-spacing-m)) var(--kirby-spacing-xs);
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
    }
    .toolbar-title {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 0.2s, transform 0.2s;
      &.visible {
        opacity: 1;
        transform: none;
      }
    }
    .dismiss {
      margin: 0;
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: var(--kirby-spacing-xs);
      ::ng-deep kirby-menu > div {
        display: flex;
      }
    }
    .group {
      margin-bottom: var(--kirby-spacing-l);

      kirby-section-header {
        margin-bottom: 0;
      }
    }
    .group-card {
      background-color: var(--kirby-white);
      box-shadow: var(--kirby-elevation-2);
      border-radius: var(--kirby-border-radius-n);
      margin: 0;
      padding: var(--kirby-spacing-s) var(--kirby-spacing-m);
      box-sizing: border-box;
    }
    .approvers {
      padding: 0;
      kirby-item {
        --kirby-item-background: transparent;
      }
      overflow: hidden;
    }
    .match.clickable {
      cursor: pointer;
    }
    .match-body {
      display: flex;
      align-items: center;
      gap: var(--kirby-spacing-s);
      padding: var(--kirby-spacing-s) var(--kirby-spacing-m);
    }
    .match-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      color: var(--kirby-black);
      background-color: var(--kirby-semi-light);

      &.success {
        background-color: var(--kirby-success-tint);
      }
      &.warning {
        background-color: var(--kirby-warning-tint);
      }
      &.danger {
        background-color: var(--kirby-danger-tint);
      }
    }
    .payees {
      padding: 0;
      overflow: hidden;
    }
    .payee-row {
      display: grid;
      grid-template-rows: 1fr;
      transition:
        grid-template-rows 250ms ease,
        opacity 250ms ease;
      > * {
        overflow: hidden;
      }
      &.removing {
        grid-template-rows: 0fr;
        opacity: 0;
      }
    }
    .payee-text {
      min-width: 0;
    }
    .payee-amount {
      white-space: nowrap;
      margin-right: var(--kirby-spacing-xs);
    }
    .payee-detail {
      font-size: var(--kirby-font-size-xs);
      color: var(--kirby-text-color-semi-dark);
    }
    .status-detail {
      font-size: var(--kirby-font-size-xs);
      color: var(--kirby-text-color-semi-dark);
    }
    // Knappen har kortets modsatte flade: grå på hvidt kort, hvid på lysegråt kort
    .match-body button[kirby-button] {
      --kirby-button-background-color: var(--kirby-semi-light);
      --kirby-button-color: var(--kirby-black);
    }
    .match-text {
      flex: 1;
    }
    .group kirby-section-header kirby-checkbox {
      // Kirby-checkboksen får bredere plads i sektionsoverskriften end i rækkerne; flyttes, så den flugter.
      transform: translateX(27px);
      margin-bottom: var(--kirby-spacing-xxs);
    }
    .check-groups {
      padding: 0;
      overflow: hidden;
    }
    dl.group-card {
      display: grid;
      grid-template-columns: minmax(max-content, 1fr) 1.2fr;
      gap: var(--kirby-spacing-xs) var(--kirby-spacing-m);
      align-items: center;
    }
    :host(.dense) {
      dt,
      dd,
      ul.activities li,
      .match-text {
        font-size: var(--kirby-font-size-s);
        line-height: var(--kirby-line-height-s);
      }
    }
    dt {
      color: var(--kirby-text-color-semi-dark);
    }
    dd {
      margin: 0;
      white-space: pre-line;
      overflow-wrap: anywhere;
    }
    ul.activities {
      list-style: none;

      li {
        padding: var(--kirby-spacing-xs) 0;
        border-bottom: 1px solid var(--kirby-color-border-base-quiet, #dadada);

        &:last-child {
          border-bottom: none;
        }
      }
    }
    .muted {
      color: var(--kirby-text-color-semi-dark);
    }
  `,
})
export class PaymentDetailComponent implements OnChanges {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly titleHidden = signal(false);
  readonly scrolled = signal(false);

  constructor() {
    if (this.modalProps) Object.assign(this, this.modalProps);
    // Scroll-hændelser bobler ikke, så de fanges på dokumentet, uanset hvilken container der ruller
    const onScroll = (e: Event) => {
      const el = this.host.nativeElement;
      const target = e.target as Node;
      if (!(target instanceof HTMLElement) || !target.contains(el)) return;
      this.scrolled.set(target.scrollTop > 0);
      const header = el.querySelector('header kirby-header');
      const bar = el.querySelector('.toolbar');
      if (header && bar) this.titleHidden.set(header.getBoundingClientRect().bottom <= bar.getBoundingClientRect().bottom);
    };
    document.addEventListener('scroll', onScroll, true);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', onScroll, true));
  }

  ngOnChanges(changes: SimpleChanges) {
    // Panelet scroller i en overordnet container, som nulstilles ved nyt valg. Ikke ved første
    // visning, hvor der intet er at nulstille, så åbningen ikke tvinger browseren til en ekstra opmåling.
    if (!changes['paymentId'] || changes['paymentId'].firstChange) return;
    this.titleHidden.set(false);
    this.scrolled.set(false);
    let el: HTMLElement | null = this.host.nativeElement;
    while (el) {
      if (el.scrollTop) el.scrollTop = 0;
      el = el.parentElement;
    }
  }

  readonly service = inject(PaymentsService);
  private readonly modal = inject(ModalController);
  private readonly tableConfig = inject(TableConfigService);
  readonly payeeText = 'Der er lønbetalinger uden match mellem modtagers navn og kontoejer';

  readonly removing = signal<Set<string>>(new Set());
  readonly removed = signal<Set<string>>(new Set());

  visiblePayees(p: Payment): Payee[] | undefined {
    return p.payees?.filter((x) => !this.removed().has(x.number));
  }

  /** Svar, der er fravalgt til godkendelse. Intet match er fravalgt fra start. */
  readonly deselected = signal<Set<RecipientCheck>>(new Set<RecipientCheck>(['Intet match']));

  checkGroups(p: Payment) {
    const groups = new Map<RecipientCheck, { check: RecipientCheck; count: number; amount: number }>();
    for (const x of this.visiblePayees(p) ?? []) {
      const g = groups.get(x.recipientCheck) ?? { check: x.recipientCheck, count: 0, amount: 0 };
      g.count++;
      g.amount += x.amount;
      groups.set(x.recipientCheck, g);
    }
    return [...groups.values()].sort((a, b) => CHECK_ORDER.indexOf(a.check) - CHECK_ORDER.indexOf(b.check));
  }

  toggleCheck(check: RecipientCheck, on: boolean) {
    this.deselected.update((s) => {
      const n = new Set(s);
      if (on) n.delete(check);
      else n.add(check);
      return n;
    });
  }

  allChecked(p: Payment) {
    return this.checkGroups(p).every((g) => !this.deselected().has(g.check));
  }

  someChecked(p: Payment) {
    const n = this.checkGroups(p).filter((g) => !this.deselected().has(g.check)).length;
    return n > 0 && n < this.checkGroups(p).length;
  }

  toggleAll(p: Payment, on: boolean) {
    this.deselected.set(on ? new Set() : new Set(this.checkGroups(p).map((g) => g.check)));
  }

  /** Godkend er kun mulig, når mindst ét svar er valgt (ved lønbetalinger). */
  canApproveSelected(p: Payment) {
    return canApprove(p) && (!p.payees || this.checkGroups(p).some((g) => !this.deselected().has(g.check)));
  }

  flagLevel(check: RecipientCheck) {
    const color = this.checkColor[check];
    return color === 'semi-light' ? 'info' : color;
  }

  shownCheck(p: Payment): RecipientCheck {
    const list = this.visiblePayees(p);
    return list?.length ? worstCheck(list.map((x) => x.recipientCheck)) : p.recipientCheck;
  }

  removePayee(payee: Payee) {
    this.removing.update((s) => new Set(s).add(payee.number));
    setTimeout(() => this.removed.update((s) => new Set(s).add(payee.number)), 250);
  }

  payeeColor(p: Payee) {
    return this.checkColor[p.recipientCheck];
  }

  payeeIcon(p: Payee) {
    return this.checkIcon[p.recipientCheck];
  }

  payeeLabel(p: Payee) {
    return this.tableConfig.config().showPayeeNames ? `${p.name} • ${p.number}` : p.number;
  }

  /** Modtagertjek på en almindelig betaling. Navn og kontoejer må altid vises her. */
  openCheck(p: Payment) {
    const check = p.recipientCheck;
    this.modal.showModal({
      component: PayeeCheckDialogComponent,
      flavor: 'modal',
      size: 'medium',
      customHeight: check === 'Intet match' ? '600px' : MODAL_HEIGHTS[check],
      collapseTitle: false,
      componentProps: {
        payee: {
          number: '',
          name: p.recipient,
          registeredOwner: check === 'Match' ? p.recipient : `${p.recipient} Holm`,
          toAccount: p.toAccount,
          amount: p.amount,
          recipientCheck: check,
        } satisfies Payee,
        showNames: true,
        isPayee: false,
      },
    });
  }

  openPayee(payee: Payee) {
    this.modal.showModal({
      component: PayeeCheckDialogComponent,
      flavor: 'modal',
      size: 'medium',
      customHeight:
        payee.recipientCheck === 'Intet match' && !this.tableConfig.config().showPayeeNames
          ? '750px'
          : MODAL_HEIGHTS[payee.recipientCheck],
      collapseTitle: false,
      componentProps: { payee, showNames: this.tableConfig.config().showPayeeNames },
    });
  }
  // Når komponenten åbnes i en Kirby-modal, leveres værdierne som componentProps
  private readonly modalProps = inject<Partial<PaymentDetailComponent>>(COMPONENT_PROPS, { optional: true });


  @HostBinding('class') get hostClass() {
    return `variant-${this.variant}${this.presentation === 'page' ? ' page' : ''}${this.presentation === 'modal' ? ' modal' : ''}`;
  }

  @Input() paymentId?: number;
  @Input() presentation: DetailPresentation = 'panel';
  @Input() variant: Container = 'canvas';
  get outlined() {
    return this.variant !== 'canvas' && this.presentation !== 'modal';
  }
  /** Rækkehøjden i tabellen; kompakt og standard giver mindre tekst i detaljerne. */
  @Input() density: Density = 'standard';

  @HostBinding('class.dense') get dense() {
    return this.density !== 'spacious';
  }
  @Output() closed = new EventEmitter<void>();

  readonly ButtonSize = ButtonSize;
  readonly statusColor = STATUS_COLORS;
  needsAttention = (s: PaymentStatus) => STATUS_NEEDS_ATTENTION.has(s);
  readonly checkColor = CHECK_COLORS;
  readonly checkIcon = CHECK_ICONS;
  readonly checkText = CHECK_TEXTS;
  readonly canApprove = canApprove;
  readonly canStop = canStop;
  readonly canEdit = canEdit;
  readonly formatAmount = formatAmount;
  readonly formatDate = formatDate;

  payment() {
    return this.service.get(this.paymentId);
  }

  details() {
    return paymentDetails(this.payment()!);
  }

  close() {
    this.closed.emit();
  }
}
