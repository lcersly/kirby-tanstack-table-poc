export interface PaymentRecord {
  readonly date: string;
  readonly recipient: string;
  readonly amount: string;
  readonly currency: string;
  readonly paymentType: string;
  readonly destinationAccount: string;
  readonly status: string;
}

const referenceDate = Date.UTC(2026, 9, 27);
const millisecondsPerDay = 24 * 60 * 60 * 1000;
const dateFormatter = new Intl.DateTimeFormat('da-DK', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const amountFormatter = new Intl.NumberFormat('da-DK', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const recipients = [
  'Nordlys Kontor ApS',
  'Fjord & Form ApS',
  'Maja Sørensen',
  'Anders Holm',
  'Kystens Gartneri',
  'Lærke Jensen',
  'Havblik Teknik A/S',
  'Emil Nielsen',
  'Birkeholm Rådgivning',
  'Freja Møller',
  'Skovvang Kontorfællesskab',
  'Søholm Transport',
];
const currencies = ['DKK', 'EUR', 'SEK', 'USD'];
const paymentTypes = [
  'Overførsel',
  'Indenlandsk betaling',
  'Udenlandsk betaling',
  'Løn',
];
const statuses = ['Gennemført', 'Afventer', 'Afvist'];

export function createSyntheticPayments(count: number): PaymentRecord[] {
  let state = 0x6d2b79f5;
  const next = (): number => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };

  return Array.from({ length: count }, () => {
    const daysAgo = Math.floor(next() * 366);
    const paymentDate = new Date(referenceDate - daysAgo * millisecondsPerDay);
    const amountInOre = 1_000 + Math.floor(next() * 2_500_000);
    const accountNumber = 10_000_000 + Math.floor(next() * 90_000_000);

    return {
      date: dateFormatter.format(paymentDate),
      recipient: recipients[Math.floor(next() * recipients.length)],
      amount: amountFormatter.format(amountInOre / 100),
      currency: currencies[Math.floor(next() * currencies.length)],
      paymentType: paymentTypes[Math.floor(next() * paymentTypes.length)],
      destinationAccount: `0000 ${accountNumber}`,
      status: statuses[Math.floor(next() * statuses.length)],
    };
  });
}
