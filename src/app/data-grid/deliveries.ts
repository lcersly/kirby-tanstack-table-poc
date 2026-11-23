import { NgTemplateOutlet } from '@angular/common';
import { Component, ViewChild, computed, inject, signal } from '@angular/core';
import { AvatarComponent } from '@kirbydesign/designsystem/avatar';
import { ButtonComponent } from '@kirbydesign/designsystem/button';
import { CardComponent } from '@kirbydesign/designsystem/card';
import { DropdownComponent } from '@kirbydesign/designsystem/dropdown';
import { ListItemTemplateDirective } from '@kirbydesign/designsystem/list';
import { COMPONENT_PROPS, ModalController } from '@kirbydesign/designsystem/modal';
import { PageTitleComponent } from '@kirbydesign/designsystem/page';
import { EmptyStateComponent } from '@kirbydesign/designsystem/empty-state';
import { IconComponent } from '@kirbydesign/designsystem/icon';
import { ItemComponent } from '@kirbydesign/designsystem/item';
import { SectionHeaderComponent } from '@kirbydesign/designsystem/section-header';
import { FlagComponent } from '@kirbydesign/designsystem/flag';
import { ApproveCheckModalComponent } from './approve-check-modal';
import { CHECK_ICONS, Payment, PaymentStatus, createPayments, formatAmount } from './payments';
import { TableConfigService } from './table-config';
import { PaymentsTableComponent } from './payments-table';

type Tone = 'danger' | 'warning' | 'success' | 'neutral';

interface DeliveryLine {
  label: string;
  statuses: PaymentStatus[];
  count: number;
  amount: number;
  tone: Tone;
}

interface Delivery {
  number: number;
  date: Date;
  sender: string;
  blocked: DeliveryLine[];
  pending: DeliveryLine[];
  /** Modtagertjek udføres på alle betalinger i en leverance, eller er fravalgt for hele leverancen */
  checkExempt: boolean;
  loaded: number;
  loadedAmount: number;
  pendingCount: number;
  pendingAmount: number;
}

/** Fiktiv "i dag" i prototypen */
const TODAY = new Date(2026, 10, 16);
const SENDERS = ['Indlæst af Emil Andersen (EAN)', 'ERP', 'Indlæst af Mette Holm (MHO)', 'ERP', 'Indlæst af Jens Kragh (JKR)'];
const MONTHS = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december'];

const PERIODS = [
  { id: 'today', label: 'I dag' },
  { id: 'week', label: 'Sidste 7 dage' },
  { id: 'm10', label: 'November' },
  { id: 'm9', label: 'Oktober' },
  { id: 'm8', label: 'September' },
] as const;

function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isWorkday(d: Date) {
  return d.getDay() !== 0 && d.getDay() !== 6;
}

function addWorkdays(d: Date, n: number) {
  const out = new Date(d);
  while (n !== 0) {
    out.setDate(out.getDate() + Math.sign(n));
    if (isWorkday(out)) n -= Math.sign(n);
  }
  return out;
}

/** Simulerer en kunde, der indlæser en leverance cirka hver tredje arbejdsdag */
function buildDeliveries(): Delivery[] {
  const rnd = random(20260916);
  const first = new Date(2022, 0, 1);
  const list: Delivery[] = [];
  let date = isWorkday(TODAY) ? new Date(TODAY) : addWorkdays(TODAY, -1);
  let number = 20060;
  let age = 0;
  while (date >= first) {
    const line = (label: string, statuses: PaymentStatus[], count: number, tone: Tone): DeliveryLine => ({
      label,
      statuses,
      count,
      tone,
      amount: Math.round(count * (900 + rnd() * 5200) * 100) / 100,
    });
    const between = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
    const stopped = rnd() < 0.3 ? between(1, 3) : 0;
    const rejected = age < 12 && rnd() < 0.25 ? between(1, 2) : 0;
    const failed = age < 8 && rnd() < 0.4 ? between(1, 2) : 0;
    const fresh = age <= 3;
    const mid = age > 3 && age <= 9;
    const afv1 = fresh ? between(2, 9) : 0;
    const afv2 = fresh ? between(3, 12) : mid ? between(0, 4) : 0;
    const approved = between(fresh ? 0 : 6, fresh ? 2 : 24);
    const blocked = [
      line('Stoppede', ['Stoppet'], stopped, 'danger'),
      line('Fejl', ['Fejl'], failed, 'warning'),
      line('Afviste', ['Afvist'], rejected, 'danger'),
      line('Godkendte', ['Gennemført'], approved, 'success'),
    ].filter((l) => l.count > 0);
    const pending = [
      line('Afventer 1. godkendelse', ['Afventer 1. godkendelse'], afv1, 'neutral'),
      line('Afventer 2. godkendelse', ['Afventer 2. godkendelse'], afv2, 'neutral'),
    ].filter(
      (l) => l.count > 0,
    );
    const sum = (ls: DeliveryLine[], f: (l: DeliveryLine) => number) => ls.reduce((n, l) => n + f(l), 0);
    list.push({
      number: number--,
      date,
      sender: SENDERS[Math.floor(rnd() * SENDERS.length)],
      checkExempt: false,
      blocked,
      pending,
      loaded: sum([...blocked, ...pending], (l) => l.count),
      loadedAmount: sum([...blocked, ...pending], (l) => l.amount),
      pendingCount: sum(pending, (l) => l.count),
      pendingAmount: sum(pending, (l) => l.amount),
    });
    const step = between(2, 4);
    date = addWorkdays(date, -step);
    age += step;
  }
  // Eksempler i november: en leverance med afviste og en med stoppede betalinger
  const nov = list.filter((d) => d.date.getFullYear() === TODAY.getFullYear() && d.date.getMonth() === TODAY.getMonth());
  if (nov[2]) setBlocked(nov[2], 'Afviste', 'Afvist', 3, 'danger');
  if (nov[3]) setBlocked(nov[3], 'Stoppede', 'Stoppet', 4, 'danger');
  // Eksempler på leverancer, hvor modtagertjek er fravalgt for hele leverancen
  for (const d of [nov[1], nov[4], list[list.length - 1 - 40]]) if (d) d.checkExempt = true;
  return list;
}

function recalc(d: Delivery) {
  const sum = (ls: DeliveryLine[], f: (l: DeliveryLine) => number) => ls.reduce((n, l) => n + f(l), 0);
  d.loaded = sum([...d.blocked, ...d.pending], (l) => l.count);
  d.loadedAmount = sum([...d.blocked, ...d.pending], (l) => l.amount);
  d.pendingCount = sum(d.pending, (l) => l.count);
  d.pendingAmount = sum(d.pending, (l) => l.amount);
}

/** Sætter antallet på en linje under "Kan ikke godkendes" */
function setBlocked(d: Delivery, label: string, status: PaymentStatus, count: number, tone: Tone) {
  d.blocked = d.blocked.filter((l) => l.label !== label);
  d.blocked.unshift({ label, statuses: [status], count, tone, amount: count * 2350 });
  recalc(d);
}

/** Stopper alle betalinger, der afventer godkendelse, og flytter dem til "Stoppede" */
function stopPending(d: Delivery) {
  const moved = d.pending.reduce((n, l) => n + l.count, 0);
  const amount = d.pending.reduce((n, l) => n + l.amount, 0);
  const existing = d.blocked.find((l) => l.label === 'Stoppede');
  d.blocked = d.blocked.filter((l) => l !== existing);
  d.blocked.unshift({ label: 'Stoppede', statuses: ['Stoppet'], count: (existing?.count ?? 0) + moved, amount: (existing?.amount ?? 0) + amount, tone: 'danger' });
  d.pending = [];
  recalc(d);
}

const DELIVERIES = buildDeliveries();

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Anden udbyder kan ikke forekomme i en leverance, og Fravalgt gælder kun hele leverancer
const POOL = createPayments().filter((p) => p.recipientCheck !== 'Anden udbyder' && p.recipientCheck !== 'Modtagertjek fravalgt');

/** Fiktive betalinger i en leverance. Betalingerne hentes fra testdata, og status følger den valgte linje */
function paymentsFor(d: Delivery, lines: DeliveryLine[]): Payment[] {
  const out: Payment[] = [];
  let cursor = (d.number * 7) % POOL.length;
  for (const l of [...d.blocked, ...d.pending]) {
    for (let k = 0; k < l.count; k++) {
      const base = POOL[cursor++ % POOL.length];
      if (lines.includes(l)) {
        const exempt = d.checkExempt;
        out.push({
          ...base,
          id: d.number * 100 + out.length,
          status: l.statuses[0],
          children: undefined,
          ...(exempt && {
            recipientCheck: 'Modtagertjek fravalgt' as const,
            payees: base.payees?.map((x) => ({ ...x, recipientCheck: 'Modtagertjek fravalgt' as const })),
          }),
        });
      }
    }
  }
  return out;
}

/** Stor modal med de enkelte betalinger i en leverance, vist med samme tabel som betalingsoversigten */
@Component({
  selector: 'app-delivery-payments-modal',
  imports: [PageTitleComponent, PaymentsTableComponent],
  template: `
    <kirby-page-title>{{ title }}</kirby-page-title>
    <app-payments-table></app-payments-table>
  `,
})
export class DeliveryPaymentsModalComponent {
  readonly title = inject<{ title: string }>(COMPONENT_PROPS).title;
}

interface DeliveryActivity {
  title: string;
  time: string;
}

/** Fiktive aktiviteter for en leverance, i stil med behandlingsloggen */
function activitiesFor(d: Delivery): DeliveryActivity[] {
  // En leverance, der stadig kan godkendes, er ikke færdigbehandlet
  const steps = ['Oprettet', 'Accepteret', 'Gennemført', ...(d.pendingCount ? [] : ['Færdigbehandlet'])];
  const day = `${String(d.date.getDate()).padStart(2, '0')}. ${MONTHS[d.date.getMonth()]} ${d.date.getFullYear()}`;
  const minute = 10 + (d.number % 40);
  return steps.map((title, i) => ({ title, time: `${day} · 11:${minute}:${String(10 + i * 3).padStart(2, '0')}` }));
}

/** Lille modal med en leverances aktiviteter */
@Component({
  selector: 'app-delivery-activities-modal',
  imports: [PageTitleComponent, CardComponent, ItemComponent],
  template: `
    <kirby-page-title>Leverance {{ props.number }}</kirby-page-title>
    <div class="content">
      <kirby-card variant="outlined">
        @for (a of props.activities; track $index) {
          <kirby-item>
            <div class="item-text">
              <div class="kirby-text-normal">{{ a.title }}</div>
              <div class="kirby-text-small muted">{{ a.time }}</div>
            </div>
          </kirby-item>
        }
      </kirby-card>
    </div>
  `,
  styles: `
    .content {
      padding: var(--kirby-spacing-m) var(--kirby-spacing-m) var(--kirby-spacing-xxl);
    }
    .muted {
      color: var(--kirby-text-color-semi-dark);
    }
    kirby-item:not(:last-child) {
      border-bottom: 1px solid var(--kirby-color-border-base-quiet, #dadada);
    }
  `,
})
export class DeliveryActivitiesModalComponent {
  readonly props = inject<{ number: number; activities: DeliveryActivity[] }>(COMPONENT_PROPS);
}

/** Valg af én måned inden for de seneste fem år */
@Component({
  selector: 'app-month-picker-modal',
  imports: [PageTitleComponent, DropdownComponent, ItemComponent, CardComponent],
  template: `
    <kirby-page-title>Vælg måned</kirby-page-title>
    <div class="content">
      <kirby-dropdown
        size="md"
        aria-label="År"
        [items]="years"
        [selectedIndex]="yearIndex()"
        (change)="yearIndex.set(years.indexOf($event))"
      ></kirby-dropdown>
      <kirby-card variant="outlined">
        @for (m of months(); track m.index) {
          <kirby-item [selectable]="!m.empty" [disabled]="m.empty" disclosure="arrow-more" (click)="!m.empty && pick(m.index)">
            <div class="kirby-text-normal">{{ m.label }}</div>
          </kirby-item>
        }
      </kirby-card>
    </div>
  `,
  styles: `
    .content {
      display: flex;
      flex-direction: column;
      gap: var(--kirby-spacing-m);
      padding: var(--kirby-spacing-m);
    }
    kirby-dropdown {
      width: 10rem;
    }
    kirby-item:not(:last-child) {
      border-bottom: 1px solid var(--kirby-color-border-base-quiet, #dadada);
    }
  `,
})
export class MonthPickerModalComponent {
  private readonly modal = inject(ModalController);
  readonly years = Array.from({ length: 5 }, (_, i) => String(TODAY.getFullYear() - i));
  readonly yearIndex = signal(0);
  readonly months = computed(() => {
    const year = Number(this.years[this.yearIndex()]);
    const last = year === TODAY.getFullYear() ? TODAY.getMonth() : 11;
    return MONTHS.slice(0, last + 1)
      .map((m, index) => ({
        index,
        label: m.charAt(0).toUpperCase() + m.slice(1),
        empty: !DELIVERIES.some((d) => d.date.getFullYear() === year && d.date.getMonth() === index),
      }))
      .reverse();
  });

  pick(month: number) {
    this.modal.hideTopmost({ year: Number(this.years[this.yearIndex()]), month });
  }
}

/** Bundter af betalinger, der er indlæst fra fil */
@Component({
  selector: 'app-deliveries',
  imports: [
    AvatarComponent,
    ButtonComponent,
    CardComponent,
    DropdownComponent,
    EmptyStateComponent,
    FlagComponent,
    SectionHeaderComponent,
    IconComponent,
    ItemComponent,
    ListItemTemplateDirective,
    NgTemplateOutlet,
  ],
  template: `
    <kirby-dropdown
      #dd
      class="period"
      size="md"
      aria-label="Periode"
      [items]="periodLabels()"
      [selectedIndex]="periodIndex()"
      (change)="onPeriod($event)"
    >
      <ng-template kirbyListItemTemplate let-item let-index="index" let-selected="selected" let-focused="focused">
        @if (item === MORE) {
          <div class="divider" role="separator"></div>
        }
        <kirby-item
          [selectable]="true"
          [selected]="selected"
          [class.focused]="focused"
          role="option"
          [attr.aria-selected]="selected"
          (click)="dd.onItemSelect(index)"
        >
          <p class="kirby-item-title">{{ item }}</p>
          @if (selected) {
            <kirby-icon name="checkmark-selected" slot="end"></kirby-icon>
          }
        </kirby-item>
      </ng-template>
    </kirby-dropdown>

    <div class="list">
      @for (d of visible(); track d.number) {
        <kirby-card [variant]="cfg().deliveryCard" class="delivery">
          <kirby-item class="head" [selectable]="true" disclosure="arrow-more" (click)="show(d)">
            <kirby-icon slot="start" name="signed-document"></kirby-icon>
            <div class="item-text">
              <div class="kirby-text-normal">{{ d.number }}</div>
              <div class="kirby-text-small muted">{{ dateText(d.date) }} • {{ d.sender }}</div>
            </div>
            <div slot="end" class="head-end">
              <span class="kirby-text-small muted">{{ d.loaded }} betalinger indlæst til {{ amount(d.loadedAmount) }}</span>
              @if (d.checkExempt) {
                <kirby-flag size="xs" themeColor="semi-light">
                  <span class="flag-content"><kirby-icon [name]="exemptIcon" />Modtagertjek fravalgt</span>
                </kirby-flag>
              }
            </div>
          </kirby-item>

          <div class="body">
              <div class="columns">
                @if (d.pending.length) {
                  <section>
                    <kirby-section-header><h4 heading class="sr-only">Til godkendelse</h4><span label>Til godkendelse</span></kirby-section-header>
                    <kirby-card variant="outlined" class="lines">
                      @for (l of d.pending; track l.label) {
                        <ng-container *ngTemplateOutlet="row; context: { $implicit: l, d: d }"></ng-container>
                      }
                      <kirby-item [selectable]="true" disclosure="arrow-more" (click)="showLines(d, d.pending, 'I alt')">
                        <kirby-avatar slot="start" size="xs" [text]="'' + d.pendingCount" class="neutral"></kirby-avatar>
                        <div class="item-text">
                          <div class="kirby-text-normal">I alt</div>
                          <div class="kirby-text-small muted">{{ d.pendingCount }} betalinger</div>
                        </div>
                        <strong slot="end" class="amount">{{ amount(d.pendingAmount) }}</strong>
                      </kirby-item>
                    </kirby-card>
                  </section>
                } @else {
                  <section>
                    <kirby-section-header><h4 heading class="sr-only">Til godkendelse</h4><span label>Til godkendelse</span></kirby-section-header>
                    <kirby-card variant="outlined" class="no-approvable">
                      <kirby-empty-state
                        title="Ingen betalinger kan godkendes"
                        subtitle="Det kan skyldes fejl, afviste, stoppede eller godkendte betalinger"
                      ></kirby-empty-state>
                    </kirby-card>
                  </section>
                }
                @if (d.blocked.length) {
                  <section>
                    <kirby-section-header><h4 heading class="sr-only">Kan ikke godkendes</h4><span label>Kan ikke godkendes</span></kirby-section-header>
                    <kirby-card variant="outlined" class="lines">
                      @for (l of d.blocked; track l.label) {
                        <ng-container *ngTemplateOutlet="row; context: { $implicit: l, d: d }"></ng-container>
                      }
                    </kirby-card>
                  </section>
                }
              </div>
              <!-- [OPEN POINT: Hvad Stop alle og Godkend alle gør bagefter, er ikke beskrevet] -->
              <div class="actions">
                <button kirby-button attentionLevel="1" [disabled]="!d.pendingCount" (click)="approve(d)">Godkend alle</button>
                <button kirby-button attentionLevel="3" [disabled]="!d.pendingCount" (click)="stopAll(d)">Stop alle</button>
                <button kirby-button attentionLevel="3" (click)="showActivities(d)">Aktiviteter</button>
              </div>
          </div>
        </kirby-card>
      } @empty {
        <kirby-card variant="outlined" class="no-approvable">
          <kirby-empty-state title="Ingen leverancer" subtitle="Der er ingen leverancer i den valgte periode"></kirby-empty-state>
        </kirby-card>
      }
    </div>

    <ng-template #row let-l let-d="d">
      <kirby-item [selectable]="true" disclosure="arrow-more" (click)="showLines(d, [l], lineLabel(l))">
        <kirby-avatar slot="start" size="xs" [text]="'' + l.count" [class]="l.tone"></kirby-avatar>
        <div class="item-text">
          <div class="kirby-text-normal">{{ lineLabel(l) }}</div>
          <div class="kirby-text-small muted">{{ l.count }} {{ l.count === 1 ? 'betaling' : 'betalinger' }}</div>
        </div>
        <span slot="end" class="amount">{{ amount(l.amount) }}</span>
      </kirby-item>
    </ng-template>
  `,
  styles: `
    :host {
      margin-inline: auto;
      padding-top: var(--kirby-spacing-m);
      display: block;
      max-width: 1080px;
    }
    .period {
      display: block;
      width: 16rem;
      max-width: 100%;
      margin-bottom: var(--kirby-spacing-m);
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: var(--kirby-spacing-m);
    }
    .muted {
      color: var(--kirby-text-color-semi-dark);
    }
    .head {
      --kirby-item-background: transparent;
    }
    .head-end {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: var(--kirby-spacing-xxs);
    }
    .flag-content {
      display: inline-flex;
      align-items: center;
      gap: var(--kirby-spacing-xxs);
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
    }
    .divider {
      border-top: 1px solid var(--kirby-color-border-base-quiet, #dadada);
    }
    .body {
      padding: var(--kirby-spacing-s) var(--kirby-spacing-m) var(--kirby-spacing-m);
      border-top: 1px solid var(--kirby-color-border-base-quiet, #dadada);
    }
    .columns {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--kirby-spacing-m);
      align-items: start;
    }
    @media (min-width: 768px) {
      .columns {
        grid-template-columns: 1fr 1fr;
      }
    }
    .lines {
      kirby-item:not(:last-child) {
        border-bottom: 1px solid var(--kirby-color-border-base-quiet, #dadada);
      }
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-start;
      gap: var(--kirby-spacing-xs);
      margin-top: var(--kirby-spacing-m);
      button {
        margin: 0;
      }
      button[attentionLevel='3'] {
        --kirby-button-background-color: var(--kirby-white);
      }
    }
    .no-approvable {
      padding-block: var(--kirby-spacing-xxl);
    }
    .amount {
      white-space: nowrap;
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
  `,
})
export class DeliveriesComponent {
  private readonly modal = inject(ModalController);
  readonly cfg = inject(TableConfigService).config;
  readonly MORE = 'Vælg flere';
  @ViewChild(DropdownComponent) private dropdown?: DropdownComponent;
  private readonly custom = signal<{ year: number; month: number } | null>(null);
  readonly periodIndex = signal(2);

  readonly periodLabels = computed(() => {
    const c = this.custom();
    const base = PERIODS.map((p) => p.label);
    return [...base, ...(c ? [this.monthLabel(c)] : []), this.MORE];
  });

  private readonly revision = signal(0);

  readonly visible = computed(() => {
    this.revision();
    const labels = this.periodLabels();
    const c = this.custom();
    const idx = this.periodIndex();
    if (c && idx === labels.length - 2) {
      return DELIVERIES.filter((d) => d.date.getFullYear() === c.year && d.date.getMonth() === c.month);
    }
    const id = PERIODS[idx].id;
    return DELIVERIES.filter((d) => {
      if (id === 'today') return sameDay(d.date, TODAY);
      if (id === 'week') return TODAY.getTime() - d.date.getTime() < 7 * 86400000;
      return d.date.getMonth() === Number(id.slice(1)) && d.date.getFullYear() === TODAY.getFullYear();
    });
  });

  onPeriod(label: string) {
    const index = this.periodLabels().indexOf(label);
    if (label !== this.MORE) {
      this.periodIndex.set(index);
      return;
    }
    // Dropdownen skal ikke blive stående på "Vælg flere"
    queueMicrotask(() => {
      if (this.dropdown) this.dropdown.selectedIndex = this.periodIndex();
    });
    this.modal.showModal(
      { component: MonthPickerModalComponent, flavor: 'modal', size: 'medium', customHeight: '640px' },
      (choice?: { year: number; month: number }) => {
        if (!choice) return;
        const isStandard = choice.year === TODAY.getFullYear() && [8, 9, 10].includes(choice.month);
        if (isStandard) {
          this.periodIndex.set(PERIODS.findIndex((p) => p.id === 'm' + choice.month));
        } else {
          this.custom.set(choice);
          this.periodIndex.set(this.periodLabels().length - 2);
        }
      },
    );
  }

  /** Bekræftelse, før en leverance godkendes. [OPEN POINT: hvad der sker efter bekræftelse] */
  approve(d: Delivery) {
    if (d.checkExempt) {
      // Modtagertjek er fravalgt, så der er intet resultat at vise
      this.modal.showAlert({
        title: `Godkend alle ${d.pendingCount} betalinger?`,
        message: `Beløb i alt: ${this.amount(d.pendingAmount)} DKK`,
        cancelBtn: 'Annuller',
        okBtn: 'Godkend',
      });
      return;
    }
    this.modal.showModal({
      component: ApproveCheckModalComponent,
      flavor: 'modal',
      size: 'medium',
      customHeight: '820px',
      componentProps: { items: paymentsFor(d, d.pending) },
    });
  }

  /** Åbner betalingerne for en hel leverance */
  show(d: Delivery) {
    this.showLines(d, [...d.blocked, ...d.pending], `Leverance ${d.number}`);
  }

  lineLabel(l: DeliveryLine) {
    const singular: Record<string, string> = { Stoppede: 'Stoppet', Afviste: 'Afvist', Godkendte: 'Godkendt' };
    return l.count === 1 && singular[l.label] ? singular[l.label] : l.label;
  }

  showLines(d: Delivery, lines: DeliveryLine[], label: string) {
    const title = label.startsWith('Leverance') ? label : `Leverance ${d.number} · ${label}`;
    this.modal.showModal({
      component: DeliveryPaymentsModalComponent,
      flavor: 'modal',
      size: 'full-height',
      cssClass: 'fullscreen-modal',
      componentProps: { title, payments: paymentsFor(d, lines) },
    });
  }

  readonly exemptIcon = CHECK_ICONS['Modtagertjek fravalgt'];

  stopAll(d: Delivery) {
    this.modal.showAlert(
      {
        title: 'Stop alle betalinger?',
        message: `Alle ${d.pendingCount} betalinger stoppes. Betalinger kan genoprettes de næste 5 bankdage.`,
        icon: { name: 'warning', themeColor: 'danger' },
        cancelBtn: 'Annuller',
        okBtn: { text: 'Stop', isDestructive: true },
      },
      (confirmed) => {
        if (!confirmed) return;
        stopPending(d);
        this.revision.update((n) => n + 1);
      },
    );
  }

  showActivities(d: Delivery) {
    this.modal.showModal({
      component: DeliveryActivitiesModalComponent,
      flavor: 'modal',
      size: 'small',
      componentProps: { number: d.number, activities: activitiesFor(d) },
    });
  }

  monthLabel(c: { year: number; month: number }) {
    const m = MONTHS[c.month];
    return `${m.charAt(0).toUpperCase()}${m.slice(1)} ${c.year}`;
  }

  dateText(d: Date) {
    return `${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }

  amount(n: number) {
    return formatAmount(n);
  }
}
