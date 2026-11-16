import { Injectable, computed, signal } from '@angular/core';
import { FlagColor, RecipientCheck } from './payments';

export type TransactionStatus = 'Bogført' | 'Afventer';

export interface Account {
  id: number;
  name: string;
  owner: string;
  number: string;
  currency: string;
  /** Saldo på kontoen i dag */
  balance: number;
  /** Aftalt kassekredit, som lægges oven i saldoen i "Beløb til rådighed" */
  credit: number;
}

export interface Transaction {
  id: number;
  accountId: number;
  date: string;
  /** Valørdato. Typisk samme dag, men fx første hverdag efter en weekend */
  valueDate: string;
  text: string;
  amount: number;
  currency: string;
  /** Løbende saldo på kontoen efter posteringen */
  balance: number;
  reference: string;
  status: TransactionStatus;
  /** Kun udbetalinger har et resultat af modtagertjek */
  recipientCheck: RecipientCheck | null;
  hasAttachment: boolean;
}

export const TRANSACTION_STATUS_COLORS: Record<TransactionStatus, FlagColor> = {
  Bogført: 'semi-light',
  Afventer: 'warning',
};

// [OPEN POINT: Kontoer, tekster og statusser er fiktive, indtil der foreligger rigtige data for kontobevægelser]
export const ACCOUNTS: Account[] = [
  { id: 1, name: 'Driftskonto', owner: 'Nordlys Handel ApS', number: '5051 0012345678', currency: 'DKK', balance: 2418350.75, credit: 500000 },
  { id: 2, name: 'Valutakonto EUR', owner: 'Nordlys Handel ApS', number: '5051 0087654321', currency: 'EUR', balance: 184220.4, credit: 0 },
  { id: 3, name: 'Lejeindtægter', owner: 'Havnegade Ejendomme A/S', number: '5051 0023456789', currency: 'DKK', balance: 936480.2, credit: 250000 },
  { id: 4, name: 'Entreprisekonto', owner: 'Kær & Søn Entreprise ApS', number: '5051 0034567890', currency: 'DKK', balance: 1275900, credit: 1000000 },
];

const TODAY = Date.UTC(2026, 9, 14);
const DAY = 86400000;

const OUTGOING_TEXTS = [
  'Faktura 10482 Sønderjysk Energi',
  'Løn oktober',
  'Husleje kontor',
  'Leverandør Aarhus Stålvarer',
  'Revision kvartal 3',
  'Forsikring Dansk Fiktiv',
  'Transport Fjordbyens',
  'Kontorartikler',
  'Software licens',
  'Rengøring oktober',
];
const INCOMING_TEXTS = [
  'Betaling af faktura 20931',
  'Tak for sidst',
  'Ordre 55120',
  'Faktura 10517',
  'Acontobetaling',
  'Leje november',
  'Vedr. projekt 7731',
];
const CHECKS: RecipientCheck[] = ['Match', 'Match', 'Match', 'Tæt match', 'Intet match', 'Ikke muligt', 'Modtagertjek fravalgt', 'Anden udbyder'];
const REFERENCES = ['Faktura 10482', 'ERP-7731', 'Bilag 2026-118', 'PO-55120', 'Faktura 10517', 'Bilag 2026-131'];

// Deterministisk fiktiv data, så prototypen ser ens ud hver gang
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function valueDateFor(ms: number, r: number): number {
  const weekday = new Date(ms).getUTCDay();
  if (weekday === 6) return ms + 2 * DAY;
  if (weekday === 0) return ms + DAY;
  return r < 0.12 ? ms + DAY : ms;
}

export function createTransactions(account: Account, count = 600): Transaction[] {
  const rand = random(account.id * 7919);
  const scale = account.currency === 'EUR' ? 1 : 8;
  let day = TODAY + 2 * DAY;
  const list: Transaction[] = [];
  for (let i = 0; i < count; i++) {
    if (rand() < 0.45) day -= DAY;
    const incoming = rand() < 0.4;
    const kind = rand();
    const size = Math.round((rand() * 18000 + 250) * scale * 100) / 100;
    const fee = kind > 0.93;
    const amount = fee ? -Math.round((rand() * 80 + 5) * 100) / 100 : incoming ? size : -size;
    const outgoing = amount < 0 && !fee;
    list.push({
      id: account.id * 1000 + i,
      accountId: account.id,
      date: iso(day),
      valueDate: iso(valueDateFor(day, rand())),
      text: fee
        ? 'Rente og gebyrer'
        : incoming
          ? INCOMING_TEXTS[Math.floor(rand() * INCOMING_TEXTS.length)]
          : OUTGOING_TEXTS[Math.floor(rand() * OUTGOING_TEXTS.length)],
      amount,
      currency: account.currency,
      balance: 0,
      reference: rand() < 0.5 ? REFERENCES[Math.floor(rand() * REFERENCES.length)] : '',
      status: i < 4 ? 'Afventer' : 'Bogført',
      recipientCheck: outgoing ? CHECKS[Math.floor(rand() * CHECKS.length)] : null,
      hasAttachment: rand() < 0.25,
    });
  }
  // Løbende saldo regnes baglæns, så den seneste bogførte postering ender på kontoens saldo
  let balance = account.balance + list.filter((t) => t.status === 'Afventer').reduce((n, t) => n + t.amount, 0);
  for (const t of list) {
    t.balance = Math.round(balance * 100) / 100;
    balance -= t.amount;
  }
  return list;
}

@Injectable({ providedIn: 'root' })
export class TransactionsService {
  readonly accounts = ACCOUNTS;
  readonly accountId = signal(ACCOUNTS[0].id);
  readonly account = computed(() => ACCOUNTS.find((a) => a.id === this.accountId())!);
  private readonly byAccount = new Map(ACCOUNTS.map((a) => [a.id, createTransactions(a)]));
  readonly transactions = computed(() => this.byAccount.get(this.accountId()) ?? []);
}
