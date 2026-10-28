import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-table-playground',
  template: `
    <main class="table-playground">
      <h1>Table Playground</h1>
    </main>
  `,
  styles: `
    :host {
      display: block;
    }

    .table-playground {
      width: min(100%, 1500px);
      margin: 0 auto;
      padding: 2.5rem clamp(1.25rem, 3vw, 3rem);
    }

    h1 {
      margin: 0;
      color: #152b3c;
      font-size: clamp(2rem, 2.7vw, 2.6rem);
      font-weight: 600;
      letter-spacing: -0.035em;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablePlayground {}
