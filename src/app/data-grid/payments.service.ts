import { Injectable, signal } from '@angular/core';
import {
  Payment,
  PaymentStatus,
  canApprove,
  canStop,
  createPayments,
  nextStatusAfterApproval,
} from './payments';

@Injectable({ providedIn: 'root' })
export class PaymentsService {
  readonly payments = signal<Payment[]>(createPayments());
  /** Betalingen, der vises på en ny side (detaljevisning 'Ny side'). */
  readonly pageDetailId = signal<number | null>(null);

  get(id: number | undefined): Payment | undefined {
    return this.payments().find((p) => p.id === id);
  }

  approve(p: Payment) {
    if (canApprove(p)) this.setStatus([p.id], nextStatusAfterApproval);
  }

  stop(p: Payment) {
    if (canStop(p)) this.setStatus([p.id], () => 'Stoppet');
  }

  setStatus(ids: number[], next: (s: PaymentStatus) => PaymentStatus) {
    this.payments.update((list) =>
      list.map((p) => (ids.includes(p.id) ? { ...p, status: next(p.status) } : p)),
    );
  }
}
