import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { DataGridComponent } from '@kirbydesign/designsystem/data-grid';
import { describe, expect, it } from 'vitest';

import { DEMO_COMMIT, KIRBY_VERSION } from './demo-commit.generated';
import { createSyntheticPayments } from './payment-data';
import { PaymentOverviewPrototype } from './payment-overview';
import { PaymentTablePrototype } from './payment-table';

vi.mock('@kirbydesign/designsystem/button', async () => {
  const { Directive } = await import('@angular/core');

  class MockButtonComponent {}
  Directive({ selector: 'button[kirby-button]' })(MockButtonComponent);

  return { ButtonComponent: MockButtonComponent };
});

vi.mock('@kirbydesign/designsystem/form-field', async () => {
  const { Component, Directive, input } = await import('@angular/core');

  class MockInputComponent {}
  Directive({ selector: 'input[kirby-input]', inputs: ['hasError'] })(MockInputComponent);
  class MockFormFieldComponent {
    readonly label = input('');
  }
  Component({ selector: 'kirby-form-field', template: '<ng-content />' })(MockFormFieldComponent);

  return { InputComponent: MockInputComponent, FormFieldComponent: MockFormFieldComponent };
});

vi.mock('@kirbydesign/designsystem/icon', async () => {
  const { Directive, NgModule } = await import('@angular/core');

  class MockIconComponent {}
  Directive({ selector: 'kirby-icon' })(MockIconComponent);
  class MockIconModule {}
  NgModule({ imports: [MockIconComponent], exports: [MockIconComponent] })(MockIconModule);

  return { IconComponent: MockIconComponent, IconModule: MockIconModule };
});

describe('PaymentOverviewPrototype', () => {
  async function createOverview() {
    await TestBed.configureTestingModule({
      imports: [PaymentOverviewPrototype],
      providers: [provideRouter([]), provideNoopAnimations(), { provide: LOCALE_ID, useValue: 'da-DK' }],
    }).compileComponents();

    const fixture = TestBed.createComponent(PaymentOverviewPrototype);
    fixture.detectChanges();
    return fixture;
  }

  async function createSmallOverview() {
    const fixture = await createOverview();
    const root = fixture.nativeElement as HTMLElement;
    const count = root.querySelector<HTMLInputElement>('#payment-count')!;
    count.value = '30';
    count.dispatchEvent(new Event('input', { bubbles: true }));
    root.querySelector<HTMLButtonElement>('button[kirby-button]')!.click();
    await fixture.whenStable();
    return fixture;
  }

  it('uses a collapsed Kirby accordion for data generation and has no filter controls', async () => {
    const fixture = await createOverview();
    const root = fixture.nativeElement as HTMLElement;
    const accordion = root.querySelector<HTMLButtonElement>('kirby-accordion-item button.header')!;

    expect(accordion.textContent).toContain('Generér datasæt');
    expect(accordion.getAttribute('aria-expanded')).toBe('false');
    expect(root.querySelector('app-payment-amount-filter')).toBeNull();
    expect(root.querySelector('form')).toBeNull();
    expect(root.querySelector('kirby-dropdown')).toBeNull();
    expect(root.querySelector('.filter-summary')).toBeNull();

    accordion.click();
    await fixture.whenStable();
    expect(accordion.getAttribute('aria-expanded')).toBe('true');
    const input = root.querySelector<HTMLInputElement>('#payment-count')!;
    input.value = '4';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    root.querySelector<HTMLButtonElement>('button[kirby-button]')!.click();
    await fixture.whenStable();
    expect(root.querySelectorAll('tbody tr')).toHaveLength(4);
    accordion.click();
    await fixture.whenStable();
    expect(accordion.getAttribute('aria-expanded')).toBe('false');
    expect(root.querySelectorAll('tbody tr')).toHaveLength(4);
  });

  it('keeps selected rows when sorting and clears selection when generating data', async () => {
    const fixture = await createSmallOverview();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLElement>('tbody kirby-data-grid-row-checkbox')!.click();
    await fixture.whenStable();
    expect(root.querySelector('.table-toolbar')?.textContent).toContain('1 valgt');
    root.querySelector<HTMLButtonElement>('thead th[data-column-id="amount"] button')!.click();
    await fixture.whenStable();
    expect(root.querySelector('.table-toolbar')?.textContent).toContain('1 valgt');
    expect(root.querySelectorAll('tbody tr')).toHaveLength(30);
    const table = fixture.debugElement.query(By.directive(PaymentTablePrototype))
      .componentInstance.table;
    expect(table.getRow('payment-1').getIsSelected()).toBe(true);
    root.querySelector<HTMLButtonElement>('button[kirby-button]')!.click();
    await fixture.whenStable();
    expect(root.querySelector('.table-toolbar')?.textContent).toContain('0 valgte');
    expect(root.querySelector('thead th[data-column-id="amount"]')?.getAttribute('aria-sort')).toBe(
      'ascending',
    );
  });

  it('generates zero payments and restores rows when a positive count is generated', async () => {
    const fixture = await createSmallOverview();
    const root = fixture.nativeElement as HTMLElement;
    const count = root.querySelector<HTMLInputElement>('#payment-count')!;
    const generate = root.querySelector<HTMLButtonElement>('.generator-panel button')!;
    root.querySelector<HTMLElement>('tbody kirby-data-grid-row-checkbox')!.click();
    root.querySelector<HTMLButtonElement>('thead th[data-column-id="amount"] button')!.click();
    await fixture.whenStable();
    expect(root.querySelector('.table-toolbar')?.textContent).toContain('1 valgt');
    expect(count.min).toBe('0');
    expect(root.querySelector('#count-hint')?.textContent).toContain('0 til 100.000');

    count.value = '0';
    count.dispatchEvent(new Event('input', { bubbles: true }));
    generate.click();
    await fixture.whenStable();

    expect(root.querySelectorAll('tbody tr')).toHaveLength(0);
    expect(root.querySelector('table[role="grid"]')).not.toBeNull();
    expect(root.querySelectorAll('thead th[data-column-id]')).toHaveLength(8);
    expect(root.querySelector('.table-toolbar')?.textContent).toContain('0 valgte');
    expect(root.querySelector('[role="alert"]')).toBeNull();
    expect(count.getAttribute('aria-invalid')).toBeNull();

    count.value = '4';
    count.dispatchEvent(new Event('input', { bubbles: true }));
    generate.click();
    await fixture.whenStable();
    expect(root.querySelectorAll('tbody tr')).toHaveLength(4);
    expect(root.querySelector('.table-toolbar')?.textContent).toContain('0 valgte');
    expect(root.querySelector('thead th[data-column-id="amount"]')?.getAttribute('aria-sort')).toBe('ascending');
  });

  it('renders each payment status as a Kirby badge', async () => {
    const fixture = await createSmallOverview();
    const root = fixture.nativeElement as HTMLElement;
    const payments = createSyntheticPayments(30);
    const colors: Record<string, string> = {
      Gennemført: 'success',
      Afventer: 'warning',
      Afvist: 'danger',
    };
    const badges = Array.from(
      root.querySelectorAll<HTMLElement>('tbody td[data-column-id="status"] kirby-badge'),
    );

    expect(new Set(payments.map((payment) => payment.status)).size).toBe(3);
    expect(badges).toHaveLength(payments.length);
    for (const [index, badge] of badges.entries()) {
      expect(badge.textContent?.trim()).toBe(payments[index].status);
      expect(badge.classList.contains(colors[payments[index].status])).toBe(true);
    }

    badges[0].click();
    await fixture.whenStable();
    expect(root.querySelector('.payment-details')).toBeNull();
    expect(root.querySelector('tbody tr')?.hasAttribute('tabindex')).toBe(false);
  });

  it('renders the seven payment headers and the initial 1,000-row dataset', async () => {
    const fixture = await createOverview();
    const root = fixture.nativeElement as HTMLElement;

    expect(fixture.debugElement.query(By.directive(DataGridComponent))).not.toBeNull();
    expect(root.querySelector('table[kirbyDataGridTable]')).not.toBeNull();
    expect(root.querySelector('table')?.tabIndex).toBe(0);
    expect(root.querySelectorAll('th[data-column-id]')).toHaveLength(8);
    expect(root.querySelectorAll('td[data-column-id]')).toHaveLength(8_000);
    expect(root.querySelectorAll('thead th.sortable button')).toHaveLength(7);
    expect(root.querySelector('thead th[data-column-id="select"]')?.textContent?.trim()).toBe(
      'Vælg alle rækker',
    );
    expect(root.querySelector('tbody td[data-column-id="select"]')?.textContent).toContain(
      'Vælg betaling til Kystens Gartneri',
    );
    expect(
      [
        'date',
        'recipient',
        'amount',
        'currency',
        'paymentType',
        'destinationAccount',
        'status',
      ].map((id) => root.querySelector(`thead th[data-column-id="${id}"]`)?.textContent?.trim()),
    ).toEqual(['Dato', 'Modtager', 'Beløb', 'Valuta', 'Betalingstype', 'Modtagerkonto', 'Status']);
    expect(root.querySelectorAll('tbody tr')).toHaveLength(1_000);
    expect(root.querySelector('.result-summary')).toBeNull();
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
    expect(root.querySelectorAll('td[data-column-id]')).toHaveLength(32);
    expect(
      Array.from(root.querySelectorAll('tbody tr'), (row) =>
        [
          'date',
          'recipient',
          'amount',
          'currency',
          'paymentType',
          'destinationAccount',
          'status',
        ].map((id) => row.querySelector(`td[data-column-id="${id}"]`)?.textContent?.trim()),
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
    const invalidValues = ['', '-1', '1.5', 'not-a-number', '100001'];

    for (const value of invalidValues) {
      input.value = value;
      if (value === 'not-a-number') {
        expect(input.value).toBe('');
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
      button.click();
      fixture.detectChanges();

      expect(root.querySelector('[role="alert"]')?.textContent).toContain('0 og 100.000');
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

    const headers = Array.from(root.querySelectorAll('thead th[data-column-id]'));
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
      Array.from(root.querySelectorAll('tbody td[data-column-id="destinationAccount"]'), (cell) =>
        cell.textContent?.trim(),
      );

    expect(header.hasAttribute('aria-sort')).toBe(false);
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
    expect(header.hasAttribute('aria-sort')).toBe(false);
    expect(accounts()).toEqual(original.map((payment) => payment.destinationAccount));
  });

  it('switches the sorted column and keeps its sort when regenerating rows', async () => {
    const fixture = await createOverview();
    const root = fixture.nativeElement as HTMLElement;
    const dateHeader = root.querySelector('thead th[data-column-id="date"]')!;
    const amountHeader = root.querySelector('thead th[data-column-id="amount"]')!;
    dateHeader.querySelector('button')!.click();
    await fixture.whenStable();
    amountHeader.querySelector('button')!.click();
    await fixture.whenStable();
    expect(dateHeader.hasAttribute('aria-sort')).toBe(false);
    expect(amountHeader.getAttribute('aria-sort')).toBe('ascending');

    const input = root.querySelector<HTMLInputElement>('#payment-count')!;
    input.value = '4';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    root.querySelector<HTMLButtonElement>('button[kirby-button]')!.click();
    await fixture.whenStable();

    expect(amountHeader.getAttribute('aria-sort')).toBe('ascending');
    expect(
      Array.from(root.querySelectorAll('tbody td[data-column-id="amount"]'), (cell) =>
        cell.textContent?.trim(),
      ),
    ).toEqual(
      createSyntheticPayments(4)
        .sort((a, b) => a.amountInOre - b.amountInOre)
        .map((payment) => payment.amount),
    );
  });
});
