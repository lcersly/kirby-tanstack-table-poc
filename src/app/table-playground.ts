import { ChangeDetectionStrategy, Component } from '@angular/core';

import { DataGrid } from './data-grid/data-grid';

@Component({
  selector: 'app-table-playground',
  imports: [DataGrid],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="table-playground">
      <h1 class="visually-hidden">Table Playground</h1>
      <app-data-grid />
    </main>
  `,
  styles: `
    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
  `,
})
export class TablePlayground {}
