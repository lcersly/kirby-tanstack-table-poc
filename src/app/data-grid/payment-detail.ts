import { Component, ElementRef, EventEmitter, HostBinding, Input, OnChanges, Output, inject } from '@angular/core';
import { ButtonComponent, ButtonSize } from '@kirbydesign/designsystem/button';
import { HeaderComponent, HeaderActionsDirective } from '@kirbydesign/designsystem/header';
import { SectionHeaderComponent } from '@kirbydesign/designsystem/section-header';
import { FlagComponent } from '@kirbydesign/designsystem/flag';
import { IconComponent } from '@kirbydesign/designsystem/icon';
import { ItemComponent } from '@kirbydesign/designsystem/item';
import { MenuComponent } from '@kirbydesign/designsystem/menu';
import { COMPONENT_PROPS } from '@kirbydesign/designsystem/modal';
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
  PaymentStatus,
} from './payments';
import { PaymentsService } from './payments.service';
import { Container } from './table-config';

/** panel = inline eller sidepanel, modal = Kirby-modal, page = egen side (headeren ligger i Kirby-siden) */
export type DetailPresentation = 'panel' | 'modal' | 'page';

/** Detaljevisning af en betaling. Grupperne vises som kort, der følger tabellens ramme (canvas, hævet eller optegnet kort). */
@Component({
  selector: 'app-payment-detail',
  imports: [
    HeaderActionsDirective,
    HeaderComponent,
    SectionHeaderComponent,
    ButtonComponent,
    FlagComponent,
    IconComponent,
    ItemComponent,
    MenuComponent,
    PageTitleComponent,
  ],
  template: `
    @if (payment(); as p) {
      @if (presentation === 'modal') {
        <kirby-page-title>Betaling</kirby-page-title>
      }
      @if (presentation !== 'page') {
        <header>
          @if (presentation === 'panel') {
            <div class="top-row">
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
                <button kirby-button attentionLevel="1" [disabled]="!canApprove(p)" (click)="service.approve(p)">
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

      <section class="group">
        <div class="group-card approvers">
          <span>Mulige godkendere</span>
          <kirby-flag size="xs" themeColor="semi-light">{{ details().approverCount }}</kirby-flag>
        </div>
      </section>

      <section class="group">
        <div class="group-card match">
          <div class="match-title" [class]="checkColor[p.recipientCheck]">{{ p.recipientCheck }}</div>
          <div class="match-body">
            <span class="match-icon" [class]="checkColor[p.recipientCheck]">
              <kirby-icon [name]="checkIcon[p.recipientCheck]"></kirby-icon>
            </span>
            <span class="match-text">{{ checkText[p.recipientCheck] }}</span>
            <button kirby-button size="sm" attentionLevel="3">Læs mere</button>
          </div>
        </div>
      </section>

      <section class="group">
        <kirby-section-header><h3 heading>Modtager</h3></kirby-section-header>
        <dl class="group-card">
          @for (row of details().receiver; track row.label) {
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          }
        </dl>
      </section>

      <section class="group">
        <kirby-section-header><h3 heading>Afsender</h3></kirby-section-header>
        <dl class="group-card">
          @for (row of details().sender; track row.label) {
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          }
        </dl>
      </section>

      <section class="group">
        <kirby-section-header><h3 heading>Betaling</h3></kirby-section-header>
        <dl class="group-card">
          @for (row of details().payment; track row.label) {
            <dt>{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          }
        </dl>
      </section>

      <section class="group">
        <kirby-section-header><h3 heading>Aktiviteter</h3></kirby-section-header>
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
      display: block;
    }
    :host(:not(.page)) {
      padding: var(--kirby-spacing-m);
    }
    header {
      margin-bottom: var(--kirby-spacing-s);
    }
    .top-row {
      display: flex;
      justify-content: flex-end;
      min-height: 32px;
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
        --kirby-section-header-color: var(--kirby-text-color-black);
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
      display: flex;
      align-items: center;
      justify-content: space-between;

    }
    .match {
      padding: 0;
      overflow: hidden;
    }
    .match-title {
      text-align: center;
      padding: 2px var(--kirby-spacing-s);
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
    .status-detail {
      font-size: var(--kirby-font-size-xs);
      color: var(--kirby-text-color-semi-dark);
    }
    .match-text {
      flex: 1;
    }
    dl.group-card {
      display: grid;
      grid-template-columns: minmax(max-content, 1fr) 1.2fr;
      gap: var(--kirby-spacing-xs) var(--kirby-spacing-m);
      align-items: center;
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
        border-bottom: 1px solid var(--kirby-semi-light);

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

  ngOnChanges() {
    // Panelet scroller i en overordnet container, som nulstilles ved nyt valg
    let el: HTMLElement | null = this.host.nativeElement;
    while (el) {
      if (el.scrollTop) el.scrollTop = 0;
      el = el.parentElement;
    }
  }

  readonly service = inject(PaymentsService);
  // Når komponenten åbnes i en Kirby-modal, leveres værdierne som componentProps
  private readonly modalProps = inject<Partial<PaymentDetailComponent>>(COMPONENT_PROPS, { optional: true });

  constructor() {
    if (this.modalProps) Object.assign(this, this.modalProps);
  }

  @HostBinding('class') get hostClass() {
    return `variant-${this.variant}${this.presentation === 'page' ? ' page' : ''}`;
  }

  @Input() paymentId?: number;
  @Input() presentation: DetailPresentation = 'panel';
  @Input() variant: Container = 'canvas';
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
