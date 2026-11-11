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
    return this.payments().flatMap((p) => [p, ...(p.children ?? [])]).find((p) => p.id === id);
  }

  approve(p: Payment) {
    if (canApprove(p)) this.setStatus([p.id], nextStatusAfterApproval);
  }

  stop(p: Payment) {
    if (canStop(p)) this.setStatus([p.id], () => 'Stoppet');
  }

  setReference(id: number, reference: string) {
    this.patch(id, (p) => ({ ...p, reference }));
  }

  setToAccount(id: number, toAccount: string) {
    this.patch(id, (p) => ({ ...p, toAccount }));
  }

  setStatus(ids: number[], next: (s: PaymentStatus) => PaymentStatus) {
    // Ændres en samlepostering, følger enkeltposteringerne med
    this.payments.update((list) =>
      list.map((p) => {
        const all = ids.includes(p.id);
        const children = p.children?.map((c) => (all || ids.includes(c.id) ? { ...c, status: next(c.status) } : c));
        return { ...p, children, status: all ? next(p.status) : p.status };
      }),
    );
  }

  private patch(id: number, fn: (p: Payment) => Payment) {
    this.payments.update((list) =>
      list.map((p) => (p.id === id ? fn(p) : p.children ? { ...p, children: p.children.map((c) => (c.id === id ? fn(c) : c)) } : p)),
    );
  }
}
