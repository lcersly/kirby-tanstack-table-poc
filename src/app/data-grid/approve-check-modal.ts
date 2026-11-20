import { Component, computed, inject, signal } from '@angular/core';
import { AvatarComponent } from '@kirbydesign/designsystem/avatar';
import { ButtonComponent } from '@kirbydesign/designsystem/button';
import { CardComponent } from '@kirbydesign/designsystem/card';
import { CheckboxComponent } from '@kirbydesign/designsystem/checkbox';
import { COMPONENT_PROPS, ModalController, ModalFooterComponent } from '@kirbydesign/designsystem/modal';
import { PageTitleComponent } from '@kirbydesign/designsystem/page';
import { IconComponent } from '@kirbydesign/designsystem/icon';
import { ItemComponent } from '@kirbydesign/designsystem/item';
import { CHECK_ICONS, RecipientCheck, formatAmount } from './payments';

type Tone = 'danger' | 'warning' | 'success' | 'neutral';

/** Det, der tælles i summeringen: en betaling i en leverance eller en modtager i en lønbetaling */
export interface CheckItem {
  recipientCheck: RecipientCheck;
  amount: number;
}

const CHECK_ORDER: RecipientCheck[] = ['Match', 'Tæt match', 'Ikke muligt', 'Anden udbyder', 'Modtagertjek fravalgt', 'Intet match'];
const CHECK_TONES: Record<RecipientCheck, Tone> = {
  Match: 'success',
  'Tæt match': 'warning',
  'Intet match': 'danger',
  'Ikke muligt': 'neutral',
  'Anden udbyder': 'neutral',
  'Modtagertjek fravalgt': 'neutral',
};
const CHECK_LABELS: Partial<Record<RecipientCheck, string>> = { 'Ikke muligt': 'Modtagertjek ikke muligt' };
const DEFAULT_CHECKED: RecipientCheck[] = ['Match', 'Tæt match', 'Ikke muligt', 'Modtagertjek fravalgt'];

/** Bekræftelse af godkendelse, hvor brugeren vælger, hvilke modtagertjek-grupper der godkendes */
@Component({
  selector: 'app-approve-check-modal',
  imports: [PageTitleComponent, CardComponent, ItemComponent, AvatarComponent, IconComponent, CheckboxComponent, ButtonComponent, ModalFooterComponent],
  template: `
    <kirby-page-title>Godkend betalinger</kirby-page-title>
    <div class="content">
      <div class="head">
        <div>
          <div class="kirby-text-normal-bold">Modtagertjek</div>
          <div class="kirby-text-small muted">Vælg for at godkende</div>
        </div>
        <kirby-checkbox
          aria-label="Vælg alle modtagertjek"
          [checked]="allChecked()"
          [indeterminate]="!allChecked() && selectedCount() > 0"
          (checkedChange)="toggleAll($event)"
        ></kirby-checkbox>
      </div>
      <kirby-card>
        @for (g of groups; track g.check) {
          <kirby-item>
            <kirby-avatar slot="start" size="xs" [class]="g.tone"><kirby-icon [name]="g.icon"></kirby-icon></kirby-avatar>
            <div class="item-text">
              <div class="kirby-text-normal">{{ g.label }}</div>
              <div class="kirby-text-small muted">{{ g.count }} {{ g.count === 1 ? unit.one : unit.many }} • {{ amount(g.amount) }}</div>
            </div>
            <kirby-checkbox
              slot="end"
              [attr.aria-label]="'Godkend ' + g.label"
              [checked]="isChecked(g.check)"
              (checkedChange)="toggle(g.check, $event)"
            ></kirby-checkbox>
          </kirby-item>
        }
      </kirby-card>

      <div class="kirby-text-normal-bold totals-title">Totaler</div>
      <kirby-card>
        <kirby-item>
          <kirby-avatar slot="start" size="xs" text="∑"></kirby-avatar>
          <div class="item-text">
            <div class="kirby-text-normal">{{ selectedCount() }} {{ selectedCount() === 1 ? unit.one : unit.many }} i alt</div>
            <div class="kirby-text-small muted">Vejledende omregning</div>
          </div>
          <strong slot="end" class="amount">DKK {{ amount(selectedAmount()) }}</strong>
        </kirby-item>
      </kirby-card>
    </div>
    <kirby-modal-footer>
      <div class="footer">
        <button kirby-button attentionLevel="3" (click)="close(false)">Annullér</button>
        <button kirby-button attentionLevel="1" [disabled]="!selectedCount()" (click)="close(true)">Godkend</button>
      </div>
    </kirby-modal-footer>
  `,
  styles: `
    .content {
      display: flex;
      flex-direction: column;
      gap: var(--kirby-spacing-s);
      padding: var(--kirby-spacing-m);
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 0 0 var(--kirby-spacing-xs);
      margin-right: calc(-1 * var(--kirby-spacing-xs));
    }
    .totals-title {
      margin-top: var(--kirby-spacing-s);
      padding: 0 var(--kirby-spacing-xs);
    }
    .muted {
      color: var(--kirby-text-color-semi-dark);
    }
    .amount {
      white-space: nowrap;
    }
    kirby-item:not(:last-child) {
      border-bottom: 1px solid var(--kirby-color-border-base-quiet, #dadada);
    }
    .footer {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--kirby-spacing-xs);
      width: 100%;
      button {
        margin: 0;
      }
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
export class ApproveCheckModalComponent {
  private readonly modal = inject(ModalController);
  private readonly props = inject<{ items: CheckItem[]; unit?: { one: string; many: string } }>(COMPONENT_PROPS);
  readonly unit = this.props.unit ?? { one: 'betaling', many: 'betalinger' };
  readonly groups = CHECK_ORDER.map((check) => {
    const list = this.props.items.filter((p) => p.recipientCheck === check);
    return {
      check,
      label: CHECK_LABELS[check] ?? check,
      icon: CHECK_ICONS[check],
      tone: CHECK_TONES[check],
      count: list.length,
      amount: list.reduce((n, p) => n + p.amount, 0),
    };
  }).filter((g) => g.count > 0);
  private readonly checked = signal<ReadonlySet<RecipientCheck>>(new Set(DEFAULT_CHECKED));

  readonly allChecked = computed(() => this.groups.every((g) => this.checked().has(g.check)));
  readonly selectedCount = computed(() => this.groups.filter((g) => this.checked().has(g.check)).reduce((n, g) => n + g.count, 0));
  readonly selectedAmount = computed(() => this.groups.filter((g) => this.checked().has(g.check)).reduce((n, g) => n + g.amount, 0));

  isChecked(c: RecipientCheck) {
    return this.checked().has(c);
  }

  toggle(c: RecipientCheck, on: boolean) {
    this.checked.update((s) => {
      const next = new Set(s);
      if (on) next.add(c);
      else next.delete(c);
      return next;
    });
  }

  toggleAll(on: boolean) {
    this.checked.set(new Set(on ? this.groups.map((g) => g.check) : []));
  }

  amount(n: number) {
    return formatAmount(n);
  }

  close(result: boolean) {
    this.modal.hideTopmost(result);
  }
}
