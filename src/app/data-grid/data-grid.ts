import { Component, computed, inject, signal } from '@angular/core';
import { AppComponent as KirbyAppComponent } from '@kirbydesign/designsystem/kirby-app';
import { CardComponent } from '@kirbydesign/designsystem/card';
import { ButtonComponent, ButtonSize } from '@kirbydesign/designsystem/button';
import { IconComponent } from '@kirbydesign/designsystem/icon';
import { ItemComponent } from '@kirbydesign/designsystem/item';
import { MenuComponent } from '@kirbydesign/designsystem/menu';
import { ModalController } from '@kirbydesign/designsystem/modal';
import { ActionGroupComponent } from '@kirbydesign/designsystem/action-group';
import { HeaderActionsDirective, HeaderComponent } from '@kirbydesign/designsystem/header';
import {
  PageComponent,
  PageContentComponent,
} from '@kirbydesign/designsystem/page';
import { formatAmount, formatDate, canApprove, canEdit, canStop } from './payments';
import { PaymentsService } from './payments.service';
import { TableConfigService } from './table-config';
import { PaymentsTableComponent } from './payments-table';
import { TableSettingsComponent } from './table-settings';

interface NavItem {
  label: string;
  icon: string;
  children?: string[];
  divider?: boolean;
}

const ACTIVE_CHILD = 'Godkend betalinger';

@Component({
  selector: 'app-data-grid',
  imports: [
    KirbyAppComponent,
    ButtonComponent,
    CardComponent,
    IconComponent,
    ItemComponent,
    MenuComponent,
    ActionGroupComponent,
    HeaderActionsDirective,
    HeaderComponent,
    PageComponent,
    PageContentComponent,
    PaymentsTableComponent,
  ],
  templateUrl: './data-grid.html',
  styleUrl: './data-grid.scss',
})
export class DataGrid {
  readonly ButtonSize = ButtonSize;
  private readonly modalController = inject(ModalController);
  readonly payments = inject(PaymentsService);
  private readonly tableConfig = inject(TableConfigService);
  // På canvas strækker tabellen sig helt ud til kanterne af indholdsområdet
  readonly bleed = computed(() => this.tableConfig.config().container === 'canvas');

  /** Betalingen, der vises på en ny side. Siden får betalingens navn som titel og back-knap i toolbaren. */
  readonly detail = computed(() => this.payments.get(this.payments.pageDetailId() ?? undefined));
  readonly canApprove = canApprove;
  readonly canStop = canStop;
  readonly canEdit = canEdit;
  readonly formatAmount = formatAmount;
  readonly formatDate = formatDate;

  closeDetail() {
    this.payments.pageDetailId.set(null);
  }

  // [OPEN POINT: ikoner, bankens logo og farver følger bankens tema, når det er sat op]
  readonly navItems: NavItem[] = [
    { label: 'Overblik', icon: 'kirby' },
    { label: 'Min side', icon: 'grid' },
    { label: 'Konti', icon: 'accounts-outline', children: [] },
    {
      label: 'Betal og overfør',
      icon: 'swap',
      children: [
        ACTIVE_CHILD,
        'Kontooverførsel',
        'Indbetalingskort',
        'Udenlandsk overførsel',
        'Udenlandsk overførsel - Ny',
        'Overfør fra konti i udlandet',
        'Overførsel til NemKonto',
        'Løn',
        'Gemte modtagere',
        'Betalingsaftaler',
        'Betalingsservice',
        'SEPA Direct Debit',
        'Tidsfrister',
        'Bestil kontanter',
      ],
    },
    { label: 'Ind- og udlæs fil', icon: 'upload', children: [] },
    { label: 'Investering', icon: 'investment' },
    { label: 'Likviditetsoverblik', icon: 'salary', divider: true },
    { label: 'Markedsplads', icon: 'basket' },
    { label: 'Administration', icon: 'participants', divider: true },
    { label: 'Profil', icon: 'person-outline', divider: true },
    { label: 'Indstillinger', icon: 'cog' },
    { label: 'Kontakt og Netboks', icon: 'inbox-outline' },
  ];

  readonly activeChild = ACTIVE_CHILD;
  readonly expanded = signal<ReadonlySet<string>>(new Set(['Betal og overfør']));

  toggle(item: NavItem) {
    this.expanded.update((s) => {
      const next = new Set(s);
      if (next.has(item.label)) next.delete(item.label);
      else next.add(item.label);
      return next;
    });
  }

  readonly offset = signal({ x: 0, y: 0 });
  private dragStart?: { px: number; py: number; x: number; y: number };

  startDrag(e: PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const { x, y } = this.offset();
    this.dragStart = { px: e.clientX, py: e.clientY, x, y };
    document.body.classList.add('config-dragging');
  }

  drag(e: PointerEvent) {
    if (!this.dragStart) return;
    this.offset.set({
      x: this.dragStart.x + e.clientX - this.dragStart.px,
      y: this.dragStart.y + e.clientY - this.dragStart.py,
    });
  }

  endDrag(e: PointerEvent) {
    this.dragStart = undefined;
    document.body.classList.remove('config-dragging');
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  }

  nudge(e: KeyboardEvent) {
    const step = 16;
    const d: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (!d[e.key]) return;
    e.preventDefault();
    this.offset.update((o) => ({ x: o.x + d[e.key][0], y: o.y + d[e.key][1] }));
  }

  openSettings() {
    this.modalController.showModal({
      component: TableSettingsComponent,
      flavor: 'modal',
      size: 'large',
      interactWithBackground: true,
    });
  }
}
