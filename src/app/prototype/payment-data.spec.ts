import { describe, expect, it } from 'vitest';

import { createSyntheticPayments } from './payment-data';

describe('createSyntheticPayments', () => {
  it.each([1, 1_000, 100_000])('creates exactly %i payments', (count) => {
    expect(createSyntheticPayments(count)).toHaveLength(count);
  });

  it('returns the same records for the same requested count', () => {
    expect(createSyntheticPayments(1_000)).toEqual(createSyntheticPayments(1_000));
  });

  it('uses the fixed reference date and expected payment fields', () => {
    expect(createSyntheticPayments(1)[0]).toEqual({
      date: '27. jul. 2026',
      recipient: 'Kystens Gartneri',
      amount: '14.255,62',
      currency: 'DKK',
      paymentType: 'Overførsel',
      destinationAccount: '0000 64865557',
      status: 'Afvist',
    });
  });
});
