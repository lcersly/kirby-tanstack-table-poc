import { Component, inject, signal } from '@angular/core';
import { ButtonComponent } from '@kirbydesign/designsystem/button';
import { FormFieldComponent, InputComponent } from '@kirbydesign/designsystem/form-field';
import { COMPONENT_PROPS, ModalController } from '@kirbydesign/designsystem/modal';

/** Lille dialog, hvor brugeren bekræfter navnet på det filter, der gemmes */
@Component({
  selector: 'app-save-filter-dialog',
  imports: [ButtonComponent, FormFieldComponent, InputComponent],
  template: `
    <div class="dialog">
      <h2 class="kirby-text-large-bold">Gem filter</h2>
      <p class="kirby-text-normal">Bekræft navnet på filteret. Det vises sammen med hurtigfiltrene.</p>
      <kirby-form-field>
        <input
          kirby-input
          type="text"
          size="md"
          placeholder="Navn på filter"
          aria-label="Navn på filter"
          [attr.maxlength]="40"
          [value]="name()"
          (input)="name.set($any($event.target).value)"
          (keydown.enter)="save()"
        />
      </kirby-form-field>
      <div class="actions">
        <button kirby-button attentionLevel="2" (click)="cancel()">Annullér</button>
        <button kirby-button attentionLevel="1" [disabled]="!name().trim()" (click)="save()">Gem filter</button>
      </div>
    </div>
  `,
  styles: `
    .dialog {
      display: flex;
      flex-direction: column;
      gap: var(--kirby-spacing-s);
      padding: var(--kirby-spacing-m);
    }
    h2,
    p {
      margin: 0;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--kirby-spacing-xs);
    }
  `,
})
export class SaveFilterDialogComponent {
  private readonly modal = inject(ModalController);
  readonly name = signal('');

  constructor() {
    const props = inject<{ suggestion?: string }>(COMPONENT_PROPS, { optional: true });
    this.name.set(props?.suggestion ?? '');
  }

  cancel() {
    this.modal.hideTopmost();
  }

  save() {
    const name = this.name().trim();
    if (name) this.modal.hideTopmost(name);
  }
}
