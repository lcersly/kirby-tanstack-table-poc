import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'prototype/payment-overview',
  },
  {
    path: 'prototype/payment-overview',
    title: 'POC',
    loadComponent: () =>
      import('./prototype/payment-overview').then((module) => module.PaymentOverviewPrototype),
  },
  {
    path: 'prototype/table-playground',
    title: 'Table Playground',
    loadComponent: () => import('./table-playground').then((module) => module.TablePlayground),
  },
  {
    path: '**',
    redirectTo: 'prototype/payment-overview',
  },
];
