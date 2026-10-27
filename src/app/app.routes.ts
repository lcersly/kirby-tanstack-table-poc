import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'prototype/payment-overview',
  },
  {
    path: 'prototype/payment-overview',
    loadComponent: () =>
      import('./prototype/payment-overview').then(
        (module) => module.PaymentOverviewPrototype,
      ),
  },
  {
    path: '**',
    redirectTo: 'prototype/payment-overview',
  },
];
