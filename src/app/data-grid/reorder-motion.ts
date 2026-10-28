import { Injector, afterNextRender } from '@angular/core';

/** Kører en ændring af rækkefølgen og lader elementerne glide til deres nye plads. */
export function animateReorder(container: HTMLElement | undefined, injector: Injector, change: () => void) {
  const items = () => Array.from(container?.querySelectorAll<HTMLElement>('[data-col]') ?? []);
  const before = new Map(items().map((el) => [el.dataset['col']!, el.getBoundingClientRect().top]));
  change();
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  afterNextRender(
    () => {
      for (const el of items()) {
        const old = before.get(el.dataset['col']!);
        if (old === undefined || el.classList.contains('dragging')) continue;
        const delta = old - el.getBoundingClientRect().top;
        if (Math.abs(delta) > 1) {
          el.animate([{ transform: `translateY(${delta}px)` }, { transform: 'none' }], {
            duration: 200,
            easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
          });
        }
      }
    },
    { injector },
  );
}

/** Finder det element, pegeren står over, ud fra layoutplaceringen (ikke den animerede). */
export function itemAtPointer(container: HTMLElement | undefined, clientY: number): HTMLElement | undefined {
  const items = Array.from(container?.querySelectorAll<HTMLElement>('[data-col]') ?? []);
  return items.find((el) => {
    const parent = el.offsetParent as HTMLElement | null;
    if (!parent) return false;
    const y = clientY - parent.getBoundingClientRect().top + parent.scrollTop;
    return y >= el.offsetTop && y <= el.offsetTop + el.offsetHeight;
  });
}
