import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';

import { DEMO_COMMIT, KIRBY_VERSION } from './demo-commit.generated';
import { PaymentOverviewPrototype } from './payment-overview';

vi.mock('@kirbydesign/designsystem/button', async () => {
  const { Directive } = await import('@angular/core');

  class MockButtonComponent {}
  Directive({ selector: 'button[kirby-button]' })(MockButtonComponent);

  return { ButtonComponent: MockButtonComponent };
});

vi.mock('@kirbydesign/designsystem/form-field', async () => {
  const { Directive } = await import('@angular/core');

  class MockInputComponent {}
  Directive({ selector: 'input[kirby-input]' })(MockInputComponent);

  return { InputComponent: MockInputComponent };
});

describe('PaymentOverviewPrototype', () => {
  async function createOverview() {
    await TestBed.configureTestingModule({
      imports: [PaymentOverviewPrototype],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(PaymentOverviewPrototype);
    fixture.detectChanges();
    return fixture;
  }

  it('renders the seven payment headers and the initial 1,000-row dataset', async () => {
    const fixture = await createOverview();
    const root = fixture.nativeElement as HTMLElement;

    expect(
      Array.from(root.querySelectorAll('thead th'), (header) => header.textContent?.trim()),
    ).toEqual(['Dato', 'Modtager', 'Beløb', 'Valuta', 'Betalingstype', 'Modtagerkonto', 'Status']);
    expect(root.querySelectorAll('tbody tr')).toHaveLength(1_000);
    expect(root.querySelector('.result-summary')?.textContent).toContain(
      '1.000 syntetiske betalinger',
    );
    expect(root.textContent).toContain('Alle betalinger, konti og modtagere er syntetiske.');
    expect(root.textContent).toContain(`Kirby ${KIRBY_VERSION}`);
    expect(root.textContent).toContain(`Demo ${DEMO_COMMIT}`);
  });

  it('replaces the rendered dataset after a valid count is submitted', async () => {
    const fixture = await createOverview();
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector<HTMLInputElement>('#payment-count');
    const button = root.querySelector<HTMLButtonElement>('button[kirby-button]');

    if (!input || !button) {
      throw new Error('Payment generator controls were not rendered.');
    }

    input.value = '4';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    button.click();
    fixture.detectChanges();

    const firstRender = Array.from(root.querySelectorAll('tbody tr'), (row) =>
      row.textContent?.trim(),
    );
    expect(firstRender).toHaveLength(4);
    expect(root.querySelector('.result-summary')?.textContent).toContain('4 syntetiske betalinger');

    input.value = '4';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    button.click();
    fixture.detectChanges();

    expect(Array.from(root.querySelectorAll('tbody tr'), (row) => row.textContent?.trim())).toEqual(
      firstRender,
    );
  });

  it('shows an error and keeps the previous dataset for invalid counts', async () => {
    const fixture = await createOverview();
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector<HTMLInputElement>('#payment-count');
    const button = root.querySelector<HTMLButtonElement>('button[kirby-button]');

    if (!input || !button) {
      throw new Error('Payment generator controls were not rendered.');
    }

    const firstRow = root.querySelector('tbody tr')?.textContent?.trim();
    const invalidValues = ['', '0', '-1', '1.5', 'not-a-number', '100001'];

    for (const value of invalidValues) {
      input.value = value;
      if (value === 'not-a-number') {
        expect(input.value).toBe('');
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
      button.click();
      fixture.detectChanges();

      expect(root.querySelector('[role="alert"]')?.textContent).toContain('1 og 100.000');
      expect(root.querySelectorAll('tbody tr')).toHaveLength(1_000);
      expect(root.querySelector('tbody tr')?.textContent?.trim()).toBe(firstRow);
    }
  });
});
