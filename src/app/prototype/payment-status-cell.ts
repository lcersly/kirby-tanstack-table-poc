import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BadgeComponent } from '@kirbydesign/designsystem/badge';

@Component({
  selector: 'app-payment-status-cell',
  imports: [BadgeComponent],
  template: '<kirby-badge size="md" [themeColor]="color()">{{ status() }}</kirby-badge>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentStatusCell {
  readonly status = input.required<string>();
  protected readonly color = computed(() => {
    switch (this.status()) {
      case 'Gennemført':
        return 'success';
      case 'Afventer':
        return 'warning';
      case 'Afvist':
        return 'danger';
      default:
        return 'medium';
    }
  });
}
