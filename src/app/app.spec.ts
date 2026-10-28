import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, provideRouter, Router, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { filter, firstValueFrom } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { App } from './app';
import { routes } from './app.routes';

vi.mock('@kirbydesign/designsystem/button', async () => {
  const { Directive } = await import('@angular/core');

  class MockButtonComponent {}
  Directive({ selector: 'button[kirby-button]' })(MockButtonComponent);

  return { ButtonComponent: MockButtonComponent };
});

vi.mock('@kirbydesign/designsystem/form-field', async () => {
  const { Directive } = await import('@angular/core');

  class MockInputComponent {}
  Directive({ selector: 'input[kirby-input]' })(MockInputComponent);

  return { InputComponent: MockInputComponent };
});

@Component({
  selector: 'app-table-playground',
  template: '<main class="table-playground"><h1>Table Playground</h1></main>',
})
class StubTablePlayground {}

// Data Grid kræver Kirby/Ionic og indlæses derfor ikke i enhedstests
const testRoutes: Routes = routes.map((route) =>
  route.path === 'prototype/table-playground'
    ? { path: route.path, title: route.title, component: StubTablePlayground }
    : route,
);

describe('Playspace navigation', () => {
  async function openApp(url: string) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '', component: App, children: testRoutes }]),
        provideLocationMocks(),
      ],
    });

    const router = TestBed.inject(Router);
    router.setUpLocationChangeListener();
    const harness = await RouterTestingHarness.create(url);
    const root = harness.routeNativeElement;
    if (!root) {
      throw new Error('The app shell was not rendered.');
    }

    return { harness, root, router };
  }

  it('opens the existing POC by default and marks its navigation link active', async () => {
    const { root, router } = await openApp('/');

    expect(router.url).toBe('/prototype/payment-overview');
    expect(root.querySelector('h1')?.textContent).toBe('Betalingsoversigt');
    expect(root.querySelectorAll('tbody tr')).toHaveLength(1_000);
    expect(root.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe('POC');
    expect(document.title).toBe('POC');
  });

  it('supports direct links to the empty Table Playground', async () => {
    const { root } = await openApp('/prototype/table-playground');

    expect(root.querySelector('h1')?.textContent).toBe('Table Playground');
    expect(root.querySelector('main')?.children).toHaveLength(1);
    expect(root.querySelector('table')).toBeNull();
    expect(root.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe(
      'Table Playground',
    );
    expect(document.title).toBe('Table Playground');
    expect(document.activeElement).toBe(root.querySelector('#playspace-content'));
  });

  it('skips navigation without leaving the current route or dropping query parameters', async () => {
    const { root, router } = await openApp('/prototype/table-playground?example=1');
    const skipLink = root.querySelector<HTMLButtonElement>('.skip-link');
    if (!skipLink) {
      throw new Error('The skip navigation control was not rendered.');
    }

    skipLink.focus();
    skipLink.click();

    expect(document.activeElement).toBe(root.querySelector('#playspace-content'));
    expect(router.url).toBe('/prototype/table-playground?example=1');
  });

  it('keeps the top bar when switching playspaces and supports browser history', async () => {
    const { harness, root, router } = await openApp('/prototype/payment-overview?variant=C');
    const nav = root.querySelector('nav');
    const playgroundLink = root.querySelector<HTMLAnchorElement>(
      'a[href="/prototype/table-playground"]',
    );
    const pocLink = root.querySelector<HTMLAnchorElement>('a[href="/prototype/payment-overview"]');
    if (!playgroundLink || !pocLink) {
      throw new Error('Playspace navigation links were not rendered.');
    }

    playgroundLink.click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(router.url).toBe('/prototype/table-playground');
    expect(root.querySelector('nav')).toBe(nav);
    expect(root.querySelector('h1')?.textContent).toBe('Table Playground');
    expect(root.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(playgroundLink.getAttribute('aria-current')).toBe('page');
    expect(root.querySelector('table')).toBeNull();

    pocLink.click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(router.url).toBe('/prototype/payment-overview');
    expect(root.querySelector('nav')).toBe(nav);
    expect(root.querySelector('h1')?.textContent).toBe('Betalingsoversigt');
    expect(pocLink.getAttribute('aria-current')).toBe('page');
    expect(root.querySelector('app-table-playground')).toBeNull();

    const location = TestBed.inject(Location);
    const backNavigation = firstValueFrom(
      router.events.pipe(filter((event) => event instanceof NavigationEnd)),
    );
    location.back();
    await backNavigation;
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(router.url).toBe('/prototype/table-playground');
    expect(root.querySelector('h1')?.textContent).toBe('Table Playground');
    expect(playgroundLink.getAttribute('aria-current')).toBe('page');

    const forwardNavigation = firstValueFrom(
      router.events.pipe(filter((event) => event instanceof NavigationEnd)),
    );
    location.forward();
    await forwardNavigation;
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(router.url).toBe('/prototype/payment-overview');
    expect(root.querySelector('h1')?.textContent).toBe('Betalingsoversigt');
    expect(pocLink.getAttribute('aria-current')).toBe('page');
  });

  it('keeps the POC variant query parameter on direct links', async () => {
    const { root, router } = await openApp('/prototype/payment-overview?variant=C');

    expect(router.url).toBe('/prototype/payment-overview?variant=C');
    expect(root.querySelector('.variant-c')).not.toBeNull();
    expect(root.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe('POC');
  });

  it('continues to redirect unknown routes to the POC', async () => {
    const { root, router } = await openApp('/unknown');

    expect(router.url).toBe('/prototype/payment-overview');
    expect(root.querySelector('h1')?.textContent).toBe('Betalingsoversigt');
  });
});
