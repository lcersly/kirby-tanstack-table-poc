export type PaymentStatus =
  | 'Mangler 1. godkendelse'
  | 'Mangler 2. godkendelse'
  | 'Fejl'
  | 'Afvist'
  | 'Gennemført'
  | 'Klar'
  | 'Stoppet'
  | 'Afventer din kontrol'
  | 'Afventer bankens kontrol';

export type RecipientCheck =
  | 'Match'
  | 'Tæt match'
  | 'Ikke muligt'
  | 'Intet match'
  | 'Anden udbyder'
  | 'Modtagertjek fravalgt';

export interface Payment {
  id: number;
  date: string;
  recipient: string;
  amount: number;
  currency: string;
  type: string;
  subtype: string;
  toAccount: string;
  fromAccount: string;
  accountOwner: string;
  reference: string;
  status: PaymentStatus;
  recipientCheck: RecipientCheck;
}

export const ACTIONABLE_STATUSES: PaymentStatus[] = [
  'Mangler 1. godkendelse',
  'Mangler 2. godkendelse',
  'Klar',
  'Afventer din kontrol',
];

export const EDITABLE_STATUSES: PaymentStatus[] = [...ACTIONABLE_STATUSES, 'Fejl', 'Stoppet'];

export function canApprove(p: Payment): boolean {
  return ACTIONABLE_STATUSES.includes(p.status);
}

export function canStop(p: Payment): boolean {
  return ACTIONABLE_STATUSES.includes(p.status) || p.status === 'Afventer bankens kontrol';
}

export function canEdit(p: Payment): boolean {
  return EDITABLE_STATUSES.includes(p.status);
}

export function nextStatusAfterApproval(status: PaymentStatus): PaymentStatus {
  return status === 'Mangler 1. godkendelse' ? 'Mangler 2. godkendelse' : 'Afventer bankens kontrol';
}

const OWNERS = [
  { name: 'Nordlys Handel ApS', accounts: ['5051 0012345678', '5051 0087654321'] },
  { name: 'Havnegade Ejendomme A/S', accounts: ['5051 0023456789'] },
  { name: 'Kær & Søn Entreprise ApS', accounts: ['5051 0034567890', '5051 0045678901'] },
];

const RECIPIENTS = [
  'Møller & Vestergaard Revision ApS',
  'Sønderjysk Energi A/S',
  'Bjerregaard Kontorforsyning ApS',
  'Aarhus Stålvarer A/S',
  'Fjordbyens Transport ApS',
  'Lund Consulting I/S',
  'Hansen Maskinhandel ApS',
  'Skovgaard Fødevarer A/S',
  'Nielsen Rengøring ApS',
  'Marie Louise Sørensen',
  'Thomas Kristiansen',
  'Fiktiv Software GmbH',
  'Baltic Freight Ltd.',
  'Nordic Packaging AB',
  'Dansk Fiktiv Forsikring A/S',
  'Vestkystens Vognmandsforretning ApS',
];

const TYPES: { type: string; subtypes: string[]; currencies: string[] }[] = [
  { type: 'Indbetalingskort', subtypes: ['+01', '+71', '+73', '+75'], currencies: ['DKK'] },
  { type: 'Indland', subtypes: ['Straks', 'Samme dag', 'Standard'], currencies: ['DKK'] },
  {
    type: 'Udland',
    subtypes: ['SEPA Standard', 'SEPA Instant', 'SWIFT Standard', 'SWIFT Ekspres'],
    currencies: ['EUR', 'USD', 'SEK', 'NOK', 'GBP'],
  },
  { type: 'Løn', subtypes: ['Standard'], currencies: ['DKK'] },
];

const STATUSES: PaymentStatus[] = [
  'Mangler 1. godkendelse',
  'Mangler 1. godkendelse',
  'Mangler 2. godkendelse',
  'Mangler 2. godkendelse',
  'Klar',
  'Afventer din kontrol',
  'Afventer bankens kontrol',
  'Gennemført',
  'Gennemført',
  'Fejl',
  'Afvist',
  'Stoppet',
];

const CHECKS: RecipientCheck[] = [
  'Match',
  'Match',
  'Match',
  'Tæt match',
  'Intet match',
  'Ikke muligt',
  'Modtagertjek fravalgt',
  'Anden udbyder',
];

const REFERENCES = ['Faktura 10482', 'ERP-7731', 'Bilag 2024-118', 'PO-55120', 'Faktura 10517', 'Løn okt.', '', 'Bilag 2024-131'];

// Deterministisk fiktiv data, så prototypen ser ens ud hver gang
export function createPayments(count = 200): Payment[] {
  const payments: Payment[] = [];
  for (let i = 0; i < count; i++) {
    const t = TYPES[(i * 7 + (i % 3)) % TYPES.length];
    const owner = OWNERS[i % OWNERS.length];
    const currency = t.currencies[i % t.currencies.length];
    // Hver sjette betaling er gennemført og ligger i fortiden, så Alle og Kommende ikke viser de samme rækker
    const completed = i % 6 === 0;
    const day = completed ? 1 + (i % 13) : 28 - (i % 28);
    const toAccount =
      t.type === 'Udland'
        ? `DK${50 + (i % 40)} 0040 ${String(100000 + i * 7919).slice(0, 6)} ${String(10 + (i % 80)).padStart(2, '0')}`
        : t.type === 'Indbetalingskort'
          ? `${t.subtypes[i % t.subtypes.length]} ${String(10000000 + i * 12347).slice(0, 8)}`
          : `${String(3000 + ((i * 37) % 1500)).padStart(4, '0')} ${String(1000000 + i * 90001).padStart(10, '0')}`;
    payments.push({
      id: i + 1,
      date: `2026-10-${String(day).padStart(2, '0')}`,
      recipient: RECIPIENTS[(i * 5) % RECIPIENTS.length],
      amount: Math.round((((i * 7919) % 480000) + 1250) * 100) / 100 + (i % 4) * 0.5,
      currency,
      type: t.type,
      subtype: t.subtypes[i % t.subtypes.length],
      toAccount,
      fromAccount: owner.accounts[i % owner.accounts.length],
      accountOwner: owner.name,
      reference: REFERENCES[i % REFERENCES.length],
      status: completed ? 'Gennemført' : STATUSES[(i * 5) % STATUSES.length],
      recipientCheck: t.type === 'Indbetalingskort' || t.type === 'Løn' ? 'Modtagertjek fravalgt' : CHECKS[i % CHECKS.length],
    });
  }
  return payments;
}

export type FlagColor = 'success' | 'warning' | 'danger' | 'semi-light';

export const STATUS_COLORS: Record<PaymentStatus, FlagColor> = {
  'Mangler 1. godkendelse': 'warning',
  'Mangler 2. godkendelse': 'semi-light',
  Fejl: 'warning',
  Afvist: 'warning',
  Gennemført: 'success',
  Klar: 'semi-light',
  Stoppet: 'semi-light',
  'Afventer din kontrol': 'warning',
  'Afventer bankens kontrol': 'semi-light',
};

/** Kun statusser, der kræver brugerens handling eller opmærksomhed, vises som flag; resten vises som detalje. */
export const STATUS_NEEDS_ATTENTION: ReadonlySet<PaymentStatus> = new Set<PaymentStatus>([
  'Mangler 1. godkendelse',
  'Mangler 2. godkendelse',
  'Afventer din kontrol',
  'Fejl',
  'Afvist',
]);

export const CHECK_COLORS: Record<RecipientCheck, FlagColor> = {
  Match: 'success',
  'Tæt match': 'warning',
  'Intet match': 'danger',
  'Ikke muligt': 'semi-light',
  'Modtagertjek fravalgt': 'semi-light',
  'Anden udbyder': 'semi-light',
};

// [OPEN POINT: ikonet person-off findes ikke i den installerede Kirby-version. person-power bruges indtil videre til "fravalgt"]
export const CHECK_ICONS: Record<RecipientCheck, string> = {
  Match: 'person-check',
  'Tæt match': 'person-warning',
  'Intet match': 'person-close',
  'Ikke muligt': 'person-blocked',
  'Modtagertjek fravalgt': 'person-power',
  'Anden udbyder': 'person-cloud',
};

const numberFormat = new Intl.NumberFormat('da-DK', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});


export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function formatAmount(amount: number): string {
  return numberFormat.format(amount);
}

export const CHECK_TEXTS: Record<RecipientCheck, string> = {
  Match: 'Modtagers navn svarer til registreret kontoejer',
  'Tæt match': 'Modtagers navn ligner registreret kontoejer',
  'Intet match': 'Modtagers navn svarer ikke til registreret kontoejer',
  'Ikke muligt': 'Modtagertjek kunne ikke gennemføres',
  'Modtagertjek fravalgt': 'Der er ikke foretaget modtagertjek',
  'Anden udbyder': 'Modtagers bank understøtter ikke modtagertjek',
};

export interface DetailRow {
  label: string;
  value: string;
}

export interface DetailActivity {
  title: string;
  by: string;
  date: string;
}

export interface PaymentDetails {
  approverCount: number;
  receiver: DetailRow[];
  sender: DetailRow[];
  payment: DetailRow[];
  activities: DetailActivity[];
}

const BANKS = ['Jyske Bank', 'Danske Bank', 'Nordea', 'Sydbank', 'Nykredit'];
const PEOPLE = ['Karl Heinz Rumenigge', 'Jonas Beck', 'Maria Holm', 'Søren Dall'];

// [OPEN POINT: Felterne i detaljerne er fiktive og afledt af betalingen, indtil den rigtige datastruktur kendes]
export function paymentDetails(p: Payment): PaymentDetails {
  const invoice = String(1000000 + p.id * 7919).slice(0, 7);
  const created = '2026-10-01';
  const activities: DetailActivity[] = [
    { title: 'Oprettet', by: PEOPLE[p.id % PEOPLE.length], date: created },
  ];
  if (p.status !== 'Mangler 1. godkendelse') {
    activities.push({ title: 'Første godkendelse', by: PEOPLE[(p.id + 1) % PEOPLE.length], date: '2026-10-05' });
  }
  if (['Klar', 'Afventer bankens kontrol', 'Gennemført'].includes(p.status)) {
    activities.push({ title: 'Anden godkendelse', by: PEOPLE[(p.id + 2) % PEOPLE.length], date: '2026-10-08' });
  }
  if (p.status === 'Stoppet') {
    activities.push({ title: 'Stoppet', by: PEOPLE[(p.id + 2) % PEOPLE.length], date: '2026-10-09' });
  }
  return {
    approverCount: 1 + (p.id % 3),
    receiver: [
      { label: 'Modtagers navn', value: p.recipient },
      { label: 'Til konto', value: p.toAccount },
      { label: 'Bank', value: BANKS[p.id % BANKS.length] },
      { label: 'Besked', value: p.reference || '–' },
      { label: 'Hos modtager', value: formatDate(p.date) },
      { label: 'Fakturanummer', value: invoice },
      { label: 'Afsenders ID', value: String(7000000 + p.id * 131) },
    ],
    sender: [
      { label: 'Fra konto', value: `${p.accountOwner}\n${p.fromAccount}` },
      { label: 'Tekst', value: p.recipient },
      { label: 'Modtagers ID', value: invoice },
      { label: 'Bilagsreference', value: p.reference || '–' },
      { label: 'På vegne af', value: p.accountOwner },
    ],
    payment: [
      { label: 'Hæves', value: formatDate(p.date) },
      { label: 'Betalingstype', value: p.type },
      { label: 'Produkt', value: p.subtype },
      { label: 'Valuta', value: p.currency },
    ],
    activities,
  };
}

// [OPEN POINT: Kurser og kontoenes bogføringsmønt er fiktive, indtil rigtige data kendes]
const RATES_TO_DKK: Record<string, number> = { DKK: 1, EUR: 7.46, USD: 6.9, GBP: 8.6, SEK: 0.65, NOK: 0.64 };

const ACCOUNT_CURRENCY: Record<string, string> = {
  '5051 0012345678': 'DKK',
  '5051 0087654321': 'EUR',
  '5051 0023456789': 'DKK',
  '5051 0034567890': 'DKK',
  '5051 0045678901': 'USD',
};

export function accountCurrency(account: string): string {
  return ACCOUNT_CURRENCY[account] ?? 'DKK';
}

export function convert(amount: number, from: string, to: string): number {
  return (amount * (RATES_TO_DKK[from] ?? 1)) / (RATES_TO_DKK[to] ?? 1);
}
