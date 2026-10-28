import { NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  isDevMode,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonComponent } from '@kirbydesign/designsystem/button';
import { InputComponent } from '@kirbydesign/designsystem/form-field';

import { DEMO_COMMIT, KIRBY_VERSION } from './demo-commit.generated';
import { createSyntheticPayments } from './payment-data';
import { PaymentTablePrototype } from './payment-table';

type LayoutVariant = 'A' | 'B' | 'C';

const layoutNames: Record<LayoutVariant, string> = {
  A: 'Kontroller over tabellen',
  B: 'Kontroller i sidepanel',
  C: 'Kompakt overskrift',
};

function resolveVariant(value: string | null): LayoutVariant {
  return value === 'B' || value === 'C' ? value : 'A';
}

@Component({
  selector: 'app-payment-overview-prototype',
  imports: [
    ButtonComponent,
    InputComponent,
    NgTemplateOutlet,
    PaymentTablePrototype,
  ],
  templateUrl: './payment-overview.html',
  styleUrl: './payment-overview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:keydown)': 'handleVariantKey($event)',
  },
})
export class PaymentOverviewPrototype {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected readonly variant = computed(() =>
    resolveVariant(this.queryParams().get('variant')),
  );
  protected readonly variantName = computed(
    () => layoutNames[this.variant()],
  );
  protected readonly showVariantSwitcher = isDevMode();
  protected readonly demoCommit = DEMO_COMMIT;
  protected readonly kirbyVersion = KIRBY_VERSION;
  protected readonly requestedCount = signal('1000');
  protected readonly countError = signal<string | null>(null);
  protected readonly payments = signal(createSyntheticPayments(1_000));

  protected formatCount(count: number): string {
    return new Intl.NumberFormat('da-DK').format(count);
  }

  protected updateRequestedCount(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLInputElement) {
      this.requestedCount.set(target.value);
      this.countError.set(null);
    }
  }

  protected generate(): void {
    const value = this.requestedCount().trim();
    const count = Number(value);

    if (!/^\d+$/.test(value) || !Number.isSafeInteger(count)) {
      this.countError.set('Indtast et helt tal mellem 1 og 100.000.');
      return;
    }

    if (count < 1 || count > 100_000) {
      this.countError.set('Vælg mellem 1 og 100.000 betalinger.');
      return;
    }

    this.payments.set(createSyntheticPayments(count));
    this.countError.set(null);
  }

  protected selectAdjacentVariant(direction: -1 | 1): void {
    const variants: readonly LayoutVariant[] = ['A', 'B', 'C'];
    const currentIndex = variants.indexOf(this.variant());
    const nextIndex =
      (currentIndex + direction + variants.length) % variants.length;
    void this.selectVariant(variants[nextIndex]);
  }

  protected selectVariant(variant: LayoutVariant): Promise<boolean> {
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { variant },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected handleVariantKey(event: KeyboardEvent): void {
    if (
      !this.showVariantSwitcher ||
      (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')
    ) {
      return;
    }

    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        target.closest('input, textarea, select, [contenteditable="true"]'))
    ) {
      return;
    }

    event.preventDefault();
    this.selectAdjacentVariant(event.key === 'ArrowRight' ? 1 : -1);
  }
}
