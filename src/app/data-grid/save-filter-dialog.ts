import { Component, inject, signal } from '@angular/core';
import { ButtonComponent } from '@kirbydesign/designsystem/button';
import { EmptyStateComponent } from '@kirbydesign/designsystem/empty-state';
import { FormFieldComponent, InputComponent } from '@kirbydesign/designsystem/form-field';
import { COMPONENT_PROPS, ModalController } from '@kirbydesign/designsystem/modal';

/** Lille dialog, hvor brugeren bekræfter navnet på det filter, der gemmes */
@Component({
  selector: 'app-save-filter-dialog',
  imports: [EmptyStateComponent, ButtonComponent, FormFieldComponent, InputComponent],
  template: `
    <article>
      <kirby-empty-state title="Gem filter" subtitle="Bekræft navnet på filteret. Det vises sammen med hurtigfiltrene."></kirby-empty-state>
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
      <div class="buttongroup">
        <button kirby-button attentionLevel="3" (click)="cancel()">Annullér</button>
        <button kirby-button attentionLevel="1" [disabled]="!name().trim()" (click)="save()">Gem filter</button>
      </div>
    </article>
  `,
  // Layout som Kirbys Alert: samme afstande og knapper, der deler bredden 50/50
  styles: `
    article {
      display: flex;
      flex-direction: column;
      gap: var(--kirby-spacing-s);
      padding: var(--kirby-spacing-s);
      padding-top: var(--kirby-spacing-m);
    }
    kirby-form-field {
      margin: 0;
    }
    .buttongroup {
      display: flex;
      column-gap: var(--kirby-spacing-xxs);
    }
    .buttongroup button {
      flex: 1 1 0;
      min-width: 0;
      margin-inline: 0;
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
