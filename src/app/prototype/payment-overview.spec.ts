import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { ComposableDataGridComponent } from '@kirbydesign/designsystem/data-grid-composable';
import { describe, expect, it, vi } from 'vitest';

import { DEMO_COMMIT, KIRBY_VERSION } from './demo-commit.generated';
import { createSyntheticPayments } from './payment-data';
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

vi.mock('@kirbydesign/designsystem/icon', async () => {
  const { Directive } = await import('@angular/core');

  class MockIconComponent {}
  Directive({ selector: 'kirby-icon' })(MockIconComponent);

  return { IconComponent: MockIconComponent };
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

    expect(fixture.debugElement.query(By.directive(ComposableDataGridComponent))).not.toBeNull();
    expect(root.querySelector('table[kirbyDataGridTable]')).not.toBeNull();
    expect(root.querySelector('table')?.tabIndex).toBe(0);
    expect(root.querySelectorAll('th[kirby-data-grid-header-cell]')).toHaveLength(7);
    expect(root.querySelectorAll('td[kirby-data-grid-cell]')).toHaveLength(7_000);
    expect(root.querySelectorAll('thead button')).toHaveLength(7);
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
    expect(root.querySelectorAll('td[kirby-data-grid-cell]')).toHaveLength(28);
    expect(
      Array.from(root.querySelectorAll('tbody tr'), (row) =>
        Array.from(row.querySelectorAll('td'), (cell) => cell.textContent?.trim()),
      ),
    ).toEqual(
      createSyntheticPayments(4).map((payment) => [
        payment.date,
        payment.recipient,
        payment.amount,
        payment.currency,
        payment.paymentType,
        payment.destinationAccount,
        payment.status,
      ]),
    );
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

  it.each([
    ['Dato', 'dateTimestamp'],
    ['Modtager', 'recipient'],
    ['Beløb', 'amountInOre'],
    ['Valuta', 'currency'],
    ['Betalingstype', 'paymentType'],
    ['Modtagerkonto', 'destinationAccount'],
    ['Status', 'status'],
  ] as const)('sorts %s ascending, descending and back to original order', async (label, key) => {
    const fixture = await createOverview();
    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector<HTMLInputElement>('#payment-count')!;
    input.value = '20';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    root.querySelector<HTMLButtonElement>('button[kirby-button]')!.click();
    await fixture.whenStable();

    const headers = Array.from(root.querySelectorAll('thead th'));
    const header = headers.find((element) => element.textContent?.trim() === label)!;
    const button = header.querySelector('button')!;
    const original = createSyntheticPayments(20);
    const sorted = [...original].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      return typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv), 'da-DK', { numeric: true, sensitivity: 'base' });
    });
    const accounts = () =>
      Array.from(root.querySelectorAll('tbody tr'), (row) => row.children[5].textContent?.trim());

    expect(header.getAttribute('aria-sort')).toBe('none');
    button.click();
    await fixture.whenStable();
    expect(header.getAttribute('aria-sort')).toBe('ascending');
    expect(accounts()).toEqual(sorted.map((payment) => payment.destinationAccount));
    expect(
      headers.filter((element) => element.getAttribute('aria-sort') === 'ascending'),
    ).toHaveLength(1);

    button.click();
    await fixture.whenStable();
    expect(header.getAttribute('aria-sort')).toBe('descending');
    const descending = [...original].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      return typeof av === 'number' && typeof bv === 'number'
        ? bv - av
        : String(bv).localeCompare(String(av), 'da-DK', { numeric: true, sensitivity: 'base' });
    });
    expect(accounts()).toEqual(descending.map((payment) => payment.destinationAccount));

    button.click();
    await fixture.whenStable();
    expect(header.getAttribute('aria-sort')).toBe('none');
    expect(accounts()).toEqual(original.map((payment) => payment.destinationAccount));
  });

  it('switches the sorted column and keeps its sort when regenerating rows', async () => {
    const fixture = await createOverview();
    const root = fixture.nativeElement as HTMLElement;
    const headers = root.querySelectorAll('thead th');
    headers[0].querySelector('button')!.click();
    await fixture.whenStable();
    headers[2].querySelector('button')!.click();
    await fixture.whenStable();
    expect(headers[0].getAttribute('aria-sort')).toBe('none');
    expect(headers[2].getAttribute('aria-sort')).toBe('ascending');

    const input = root.querySelector<HTMLInputElement>('#payment-count')!;
    input.value = '4';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    root.querySelector<HTMLButtonElement>('button[kirby-button]')!.click();
    await fixture.whenStable();

    expect(headers[2].getAttribute('aria-sort')).toBe('ascending');
    expect(
      Array.from(root.querySelectorAll('tbody tr'), (row) => row.children[2].textContent?.trim()),
    ).toEqual(
      createSyntheticPayments(4)
        .sort((a, b) => a.amountInOre - b.amountInOre)
        .map((payment) => payment.amount),
    );
  });

  it('opens the clicked payment details, preserves them while sorting and returns focus on close', async () => {
    const fixture = await createOverview();
    const root = fixture.nativeElement as HTMLElement;
    const row = root.querySelectorAll<HTMLTableRowElement>('tbody tr')[1];
    const payment = createSyntheticPayments(2)[1];

    row.click();
    await fixture.whenStable();

    const panel = root.querySelector<HTMLElement>('[kirbyDataGridSidePanel]')!;
    expect(panel.querySelector('h2')?.textContent).toBe('Betalingsdetaljer');
    expect(
      Array.from(panel.querySelectorAll('dd'), (element) => element.textContent?.trim()),
    ).toEqual([
      payment.recipient,
      payment.date,
      `${payment.amount} ${payment.currency}`,
      payment.paymentType,
      payment.destinationAccount,
      payment.status,
    ]);
    expect(document.activeElement).toBe(panel.querySelector('h2'));
    expect(row.classList.contains('payment-row-selected')).toBe(true);

    root.querySelectorAll('thead th')[2].querySelector('button')!.click();
    await fixture.whenStable();
    expect(panel.textContent).toContain(payment.destinationAccount);
    panel.querySelector('button')!.click();
    await fixture.whenStable();
    expect(panel.querySelector('h2')).toBeNull();
    expect(document.activeElement).toBe(row);
    expect(row.classList.contains('payment-row-selected')).toBe(false);
  });

  it.each(['Enter', ' '])('opens details with %s and closes them with Escape', async (key) => {
    const fixture = await createOverview();
    const root = fixture.nativeElement as HTMLElement;
    const row = root.querySelector<HTMLTableRowElement>('tbody tr')!;

    row.focus();
    row.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    await fixture.whenStable();
    const heading = root.querySelector<HTMLElement>('#payment-details-heading')!;
    expect(document.activeElement).toBe(heading);
    heading.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(root.querySelector('#payment-details-heading')).toBeNull();
    expect(document.activeElement).toBe(row);
  });

  it('closes stale details after regenerating payments', async () => {
    const fixture = await createOverview();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLTableRowElement>('tbody tr')!.click();
    await fixture.whenStable();
    expect(root.querySelector('#payment-details-heading')).not.toBeNull();

    const input = root.querySelector<HTMLInputElement>('#payment-count')!;
    input.value = '4';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    root.querySelector<HTMLButtonElement>('button[kirby-button]')!.click();
    await fixture.whenStable();
    expect(root.querySelectorAll('tbody tr')).toHaveLength(4);
    expect(root.querySelector('#payment-details-heading')).toBeNull();
    const grid = fixture.debugElement.query(By.directive(ComposableDataGridComponent))
      .componentInstance as ComposableDataGridComponent;
    expect(grid.sidePanelOpen()).toBe(false);
  });
});
