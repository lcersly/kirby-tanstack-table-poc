import { getDebugNode, LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { SegmentedControlComponent } from '@kirbydesign/designsystem/segmented-control';
import { DataGridComponent } from '@kirbydesign/designsystem/data-grid';
import { DropdownComponent } from '@kirbydesign/designsystem/dropdown';
import { describe, expect, it } from 'vitest';

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
  const { Directive } = await import('@angular/core');

  class MockIconComponent {}
  Directive({ selector: 'kirby-icon' })(MockIconComponent);

  return { IconComponent: MockIconComponent };
});

describe('PaymentOverviewPrototype', () => {
  async function createOverview() {
    await TestBed.configureTestingModule({
      imports: [PaymentOverviewPrototype],
      providers: [provideRouter([]), { provide: LOCALE_ID, useValue: 'da-DK' }],
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

  function setAmountField(root: HTMLElement, name: string, value: string) {
    if (name === 'currency') {
      const dropdown = getDebugNode(
        root.querySelector('kirby-dropdown[formControlName="currency"]')!,
      )?.componentInstance;
      if (!(dropdown instanceof DropdownComponent)) throw new Error('Currency dropdown missing.');
      dropdown.onItemSelect(['DKK', 'EUR', 'SEK', 'USD'].indexOf(value));
      return;
    }
    const field = root.querySelector<HTMLInputElement>(`[formControlName="${name}"]`)!;
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function submitAmount(root: HTMLElement) {
    root
      .querySelector('form.amount-filter')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }

  function visibleAccounts(root: HTMLElement) {
    return Array.from(
      root.querySelectorAll('tbody td[data-column-id="destinationAccount"]'),
      (cell) => cell.textContent?.trim(),
    );
  }

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

  it('filters by status and keeps selected rows hidden by the filter', async () => {
    const fixture = await createOverview();
    const root = fixture.nativeElement as HTMLElement;
    const countInput = root.querySelector<HTMLInputElement>('#payment-count')!;
    countInput.value = '20';
    countInput.dispatchEvent(new Event('input', { bubbles: true }));
    root.querySelector<HTMLButtonElement>('button[kirby-button]')!.click();
    await fixture.whenStable();

    const payments = createSyntheticPayments(20);
    const selectedPayment = payments[0];
    const otherStatus = payments.find(
      (payment) => payment.status !== selectedPayment.status,
    )!.status;
    root
      .querySelector<HTMLElement>('tbody td[data-column-id="select"] kirby-data-grid-row-checkbox')!
      .click();
    await fixture.whenStable();
    fixture.debugElement
      .query(By.directive(SegmentedControlComponent))
      .triggerEventHandler('segmentSelect', { id: otherStatus, text: otherStatus });
    fixture.detectChanges();

    const visiblePayments = payments.filter((payment) => payment.status === otherStatus);
    expect(root.querySelectorAll('tbody tr')).toHaveLength(visiblePayments.length);
    expect(
      Array.from(root.querySelectorAll('tbody tr'), (row) =>
        row.textContent?.includes(otherStatus),
      ).every(Boolean),
    ).toBe(true);
    expect(root.querySelector('.table-toolbar')?.textContent).toContain('1 valgt');
    expect(root.querySelector('.table-toolbar')?.textContent).toContain('1 skjult af filteret');
  });

  it('filters inclusive numeric ranges in one currency, including optional bounds and no matches', async () => {
    const fixture = await createSmallOverview();
    const root = fixture.nativeElement as HTMLElement;
    const payments = createSyntheticPayments(30);
    const currency = payments[0].currency;
    const matching = payments
      .filter((payment) => payment.currency === currency)
      .sort((a, b) => a.amountInOre - b.amountInOre);
    expect(matching.length).toBeGreaterThan(2);
    const lower = matching[1].amountInOre;
    const upper = matching[matching.length - 2].amountInOre;
    const decimal = (amount: number) =>
      `${Math.floor(amount / 100)},${String(amount % 100).padStart(2, '0')}`;

    setAmountField(root, 'currency', currency);
    setAmountField(root, 'minimum', decimal(lower));
    setAmountField(root, 'maximum', decimal(upper).replace(',', '.'));
    submitAmount(root);
    await fixture.whenStable();
    expect(visibleAccounts(root)).toEqual(
      payments
        .filter(
          (payment) =>
            payment.currency === currency &&
            payment.amountInOre >= lower &&
            payment.amountInOre <= upper,
        )
        .map((payment) => payment.destinationAccount),
    );
    expect(root.querySelector('.amount-filter')?.textContent).toContain(currency);

    setAmountField(root, 'minimum', '');
    submitAmount(root);
    await fixture.whenStable();
    expect(visibleAccounts(root)).toEqual(
      payments
        .filter((payment) => payment.currency === currency && payment.amountInOre <= upper)
        .map((payment) => payment.destinationAccount),
    );

    setAmountField(root, 'minimum', decimal(lower));
    setAmountField(root, 'maximum', '');
    submitAmount(root);
    await fixture.whenStable();
    expect(visibleAccounts(root)).toEqual(
      payments
        .filter((payment) => payment.currency === currency && payment.amountInOre >= lower)
        .map((payment) => payment.destinationAccount),
    );

    setAmountField(root, 'minimum', '90071992547409,91');
    submitAmount(root);
    await fixture.whenStable();
    expect(root.querySelectorAll('tbody tr')).toHaveLength(0);
    expect(root.querySelector('[role="status"]')?.textContent).toContain('Ingen betalinger');
    expect(root.querySelector('.amount-filter [aria-live]')?.textContent).toContain(
      '90.071.992.547.409,91',
    );
  });

  it('reports invalid amounts, missing currency and reversed bounds without changing the active filter', async () => {
    const fixture = await createSmallOverview();
    const root = fixture.nativeElement as HTMLElement;
    const currency = createSyntheticPayments(30)[0].currency;
    setAmountField(root, 'currency', currency);
    setAmountField(root, 'minimum', '0');
    submitAmount(root);
    await fixture.whenStable();
    const previous = visibleAccounts(root);
    const summary = root.querySelector('.amount-filter [aria-live]')?.textContent;

    for (const invalid of ['-1', '1,234', '1.000,00', 'abc', '90071992547409,92']) {
      setAmountField(root, 'minimum', invalid);
      submitAmount(root);
      await fixture.whenStable();
      expect(root.querySelector('#amount-error')?.textContent).toContain('højst to decimaler');
      expect(
        root.querySelector('[formControlName="minimum"]')?.getAttribute('aria-describedby'),
      ).toBe('amount-error');
      expect(visibleAccounts(root)).toEqual(previous);
      expect(root.querySelector('.amount-filter [aria-live]')?.textContent).toBe(summary);
    }

    setAmountField(root, 'minimum', '2');
    setAmountField(root, 'maximum', '1');
    submitAmount(root);
    await fixture.whenStable();
    expect(root.querySelector('#amount-error')?.textContent).toContain('må ikke være større');
    expect(visibleAccounts(root)).toEqual(previous);

    setAmountField(root, 'maximum', '');
    setAmountField(root, 'currency', '');
    submitAmount(root);
    await fixture.whenStable();
    expect(root.querySelector('#amount-error')?.textContent).toContain('Vælg en valuta');
    setAmountField(root, 'minimum', '');
    submitAmount(root);
    await fixture.whenStable();
    expect(root.querySelector('#amount-error')?.textContent).toContain('mindst et beløb');
    expect(visibleAccounts(root)).toEqual(previous);
  });

  it('clears the amount filter, form and validation errors without changing the status filter', async () => {
    const fixture = await createSmallOverview();
    const root = fixture.nativeElement as HTMLElement;
    const payments = createSyntheticPayments(30);
    const status = payments[0].status;
    fixture.debugElement
      .query(By.directive(SegmentedControlComponent))
      .triggerEventHandler('segmentSelect', { id: status, text: status });
    setAmountField(root, 'currency', payments[0].currency);
    setAmountField(root, 'minimum', '0');
    submitAmount(root);
    await fixture.whenStable();

    setAmountField(root, 'minimum', 'invalid');
    submitAmount(root);
    await fixture.whenStable();
    expect(root.querySelector('#amount-error')).not.toBeNull();

    root.querySelector<HTMLButtonElement>('.amount-filter button[type="button"]')!.click();
    await fixture.whenStable();
    expect(root.querySelector('#amount-error')).toBeNull();
    expect(root.querySelector<HTMLInputElement>('[formControlName="minimum"]')?.value).toBe('');
    expect(root.querySelector<HTMLInputElement>('[formControlName="maximum"]')?.value).toBe('');
    expect(root.querySelector('.amount-filter [aria-live]')?.textContent).toContain('Intet aktivt');
    expect(visibleAccounts(root)).toEqual(
      payments.filter((payment) => payment.status === status).map((payment) => payment.destinationAccount),
    );
  });

  it('combines amount and status filters while preserving sorting and selection', async () => {
    const fixture = await createSmallOverview();
    const root = fixture.nativeElement as HTMLElement;
    const payments = createSyntheticPayments(30);
    const selected = payments[0];
    const currency = payments.find((payment) => payment.currency !== selected.currency)!.currency;
    const row = root.querySelector<HTMLTableRowElement>('tbody tr')!;
    row.querySelector<HTMLElement>('kirby-data-grid-row-checkbox')!.click();
    await fixture.whenStable();
    root.querySelector<HTMLButtonElement>('thead th[data-column-id="amount"] button')!.click();
    fixture.debugElement
      .query(By.directive(SegmentedControlComponent))
      .triggerEventHandler('segmentSelect', { id: selected.status, text: selected.status });
    setAmountField(root, 'currency', currency);
    setAmountField(root, 'minimum', '0');
    submitAmount(root);
    await fixture.whenStable();

    expect(visibleAccounts(root)).toEqual(
      payments
        .filter((payment) => payment.currency === currency && payment.status === selected.status)
        .sort((a, b) => a.amountInOre - b.amountInOre)
        .map((payment) => payment.destinationAccount),
    );
    expect(root.querySelector('.table-toolbar')?.textContent).toContain('1 skjult af filteret');
    root.querySelector<HTMLButtonElement>('.amount-filter button[type="button"]')!.click();
    await fixture.whenStable();
    expect(visibleAccounts(root)).toEqual(
      payments
        .filter((payment) => payment.status === selected.status)
        .sort((a, b) => a.amountInOre - b.amountInOre)
        .map((payment) => payment.destinationAccount),
    );
    expect(root.querySelector('.table-toolbar')?.textContent).toContain('1 valgt');
    expect(root.querySelector('.table-toolbar')?.textContent).not.toContain('skjult');
    expect(root.querySelector('.amount-filter [aria-live]')?.textContent).toContain('Intet aktivt');
    expect(root.querySelector('thead th[data-column-id="amount"]')?.getAttribute('aria-sort')).toBe(
      'ascending',
    );
  });
});
