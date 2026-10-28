import { Component, computed, inject } from '@angular/core';
import { CheckboxComponent } from '@kirbydesign/designsystem/checkbox';
import { PageTitleComponent } from '@kirbydesign/designsystem/page';
import { ButtonComponent } from '@kirbydesign/designsystem/button';
import { COLUMNS, ColumnKey, TableConfigService } from './table-config';

/** Lille modal, hvor brugeren kan sætte kryds ved de kolonner, der skal vises */
@Component({
  selector: 'app-column-chooser',
  imports: [CheckboxComponent, PageTitleComponent, ButtonComponent],
  template: `
    <kirby-page-title>Vælg kolonner</kirby-page-title>
    <ul class="list">
      @for (col of columns; track col.key) {
        <li>
          <kirby-checkbox
            [checked]="isShown(col.key)"
            [disabled]="!!col.noHide"
            (checkedChange)="service.toggleColumn(col.key, $event)"
            >{{ col.label }}</kirby-checkbox
          >
        </li>
      }
    </ul>
    <div class="footer">
      <button kirby-button attentionLevel="3" (click)="service.resetColumns()">Nulstil kolonner</button>
    </div>
  `,
  styles: `
    :host {
      display: block;
      padding: 0 var(--kirby-spacing-m) var(--kirby-spacing-m);
    }
    .list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0;
    }
    li {
      display: flex;
      align-items: center;
      min-height: 40px;
    }
    .footer {
      margin-top: var(--kirby-spacing-m);
    }
  `,
})
export class ColumnChooserComponent {
  protected readonly service = inject(TableConfigService);
  protected readonly columns = COLUMNS;
  private readonly visible = computed(() => this.service.config().visibleColumns);

  protected isShown(key: ColumnKey): boolean {
    const col = COLUMNS.find((c) => c.key === key);
    return !!col?.noHide || this.visible().includes(key);
  }
}
