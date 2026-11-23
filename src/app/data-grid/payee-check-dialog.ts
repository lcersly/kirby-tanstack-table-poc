import { Component, inject } from '@angular/core';
import { ButtonComponent } from '@kirbydesign/designsystem/button';
import { CardComponent } from '@kirbydesign/designsystem/card';
import { IconComponent } from '@kirbydesign/designsystem/icon';
import { EmptyStateComponent } from '@kirbydesign/designsystem/empty-state';
import { FlagComponent } from '@kirbydesign/designsystem/flag';
import { ItemComponent } from '@kirbydesign/designsystem/item';
import { COMPONENT_PROPS, ModalController } from '@kirbydesign/designsystem/modal';
import { PageTitleComponent } from '@kirbydesign/designsystem/page';
import { CHECK_COLORS, CHECK_ICONS, Payee, RecipientCheck } from './payments';

interface CheckCopy {
  flag: string;
  headline: string;
  text: string;
}

// [OPEN POINT: teksterne til Intet match, Ikke muligt/Anden udbyder, Fravalgt og Match er hentet fra designbillederne; Ikke muligt bruger samme tekst som Anden udbyder]
const COPY: Record<RecipientCheck, CheckCopy> = {
  Match: {
    flag: 'Match',
    headline: '',
    text: 'Modtagers navn svarer til vores oplysninger om den registrerede kontoejer',
  },
  'Tæt match': { flag: 'Tæt match', headline: '', text: '' },
  'Intet match': {
    flag: 'Intet match',
    headline: 'Navn for kort',
    text: 'Indtastet navn på modtager svarer ikke til kontoejers navn. Kontakt modtager for at bekræfte dine oplysninger.',
  },
  'Ikke muligt': {
    flag: 'Modtagertjek ikke muligt',
    headline: '',
    text: 'Det er ikke muligt at tjekke modtagers oplysninger hos modtagers bank',
  },
  'Anden udbyder': {
    flag: 'Svar fra modtagertjek ikke tilgængeligt',
    headline: '',
    text: 'Betalingen er oprettet hos en anden udbyder',
  },
  'Modtagertjek fravalgt': {
    flag: 'Modtagertjek fravalgt',
    headline: '',
    text: 'Modtagertjek er fravalgt på betalingsleverancer',
  },
};

/** Modtagertjek for en enkelt lønmodtager. Navne vises kun, hvis brugeren har adgang til dem. */
@Component({
  selector: 'app-payee-check-dialog',
  imports: [ButtonComponent, CardComponent, IconComponent, EmptyStateComponent, FlagComponent, ItemComponent, PageTitleComponent],
  template: `
    <kirby-page-title>Modtagertjek</kirby-page-title>
    <article>
      <kirby-empty-state [iconName]="icon" [class]="color"></kirby-empty-state>
      <kirby-flag [themeColor]="color">{{ copy.flag }}</kirby-flag>
      @if (payee.recipientCheck === 'Tæt match') {
        <div class="message">
          <p>
            Indtastet navn på modtager <strong>{{ showNames ? payee.name : payee.number }}</strong>
            {{ isPayee ? 'svarer kun delvist til' : 'svarer ikke helt til' }} kontoejers navn
          </p>
          @if (!showNames) {
            <p>Kontakt en medarbejder, som har adgang til gemte lønmodtagere for flere oplysninger.</p>
          }
        </div>
        @if (showNames) {
          <kirby-card variant="outlined" class="owner">
            <div class="owner-content">
              <div class="kirby-text-small label">Registreret kontoejer</div>
              <div>{{ payee.registeredOwner }}</div>
            </div>
          </kirby-card>
        }
      } @else {
        <div class="message">
          @if (isPayee && copy.headline) {
            <strong>{{ copy.headline }}</strong>
          }
          <p>{{ !isPayee && payee.recipientCheck === 'Intet match' ? 'Modtager svarer ikke til kontoejers navn. Kontakt modtager for at bekræfte dine oplysninger.' : copy.text }}</p>
          @if (showsInput && !showNames) {
            <p>Kontakt en medarbejder, som har adgang til gemte lønmodtagere for flere oplysninger.</p>
          }
        </div>
        @if (showsInput) {
          <section>
            <kirby-card variant="outlined" class="card">
              <kirby-item>
                <span class="label">{{ showNames ? 'Modtagers navn' : 'Modtager' }}</span>
                <span slot="end">{{ showNames ? payee.name : payee.number }}</span>
              </kirby-item>
              <kirby-item>
                <span class="label">Konto</span>
                <span slot="end">{{ payee.toAccount }}</span>
              </kirby-item>
          </kirby-card>
          </section>
        }
      }

      @if (payee.recipientCheck === 'Match') {
        <button kirby-button attentionLevel="3" size="sm" (click)="close()">
          <kirby-icon name="information-decoration"></kirby-icon>
          Læs mere
        </button>
      } @else {
        <p class="disclaimer">
          Vær opmærksom på, at det ikke er sikkert, du kan få dine penge tilbage, hvis du sender dem til en forkert konto.
          <a href="javascript:void(0)">Læs mere</a>
        </p>
      }
    </article>
  `,
  styles: `
    article {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: var(--kirby-spacing-m);
      text-align: center;
    }
    kirby-flag {
      margin-top: 0;
    }
    .message {
      display: flex;
      flex-direction: column;
      gap: var(--kirby-spacing-s);
      margin-top: var(--kirby-spacing-s);
    }
    .owner,
    section {
      margin-top: var(--kirby-spacing-m);
    }
    .disclaimer,
    article > button {
      margin-top: var(--kirby-spacing-m);
    }
    p {
      margin: 0;
    }
    .owner {
      align-self: stretch;
      text-align: left;
    }
    .owner-content {
      padding: var(--kirby-spacing-xs) var(--kirby-spacing-s);
    }
    section {
      align-self: stretch;
      text-align: left;
    }
    .card kirby-item:not(:last-child) {
      border-bottom: 1px solid var(--kirby-color-border-base-quiet, #dadada);
    }
    section > .label {
      margin-top: 0;
    }
    .label {
      color: var(--kirby-text-color-semi-dark);
    }
    .card {
      display: block;
      margin-top: var(--kirby-spacing-xs);
      --kirby-card-padding: 0;
      background-color: transparent;
    }
    .card kirby-item {
      --kirby-item-background-color: transparent;
      background-color: transparent;
    }
    .card ::ng-deep ion-item {
      --background: transparent;
      --ion-item-background: transparent;
    }
    .card,
    .card ::ng-deep * {
      background-color: transparent;
    }
    .disclaimer {
      font-size: var(--kirby-font-size-xs);
      color: var(--kirby-text-color-semi-dark);
    }
  `,
})
export class PayeeCheckDialogComponent {
  private readonly modal = inject(ModalController);
  private readonly props = inject<{ payee: Payee; showNames: boolean; isPayee?: boolean }>(COMPONENT_PROPS);
  readonly payee = this.props.payee;
  readonly showNames = this.props.showNames;
  readonly isPayee = this.props.isPayee ?? true;
  readonly copy = COPY[this.payee.recipientCheck];
  readonly icon = CHECK_ICONS[this.payee.recipientCheck];
  readonly color = CHECK_COLORS[this.payee.recipientCheck];
  readonly showsInput = this.payee.recipientCheck === 'Intet match';

  close(result?: boolean) {
    this.modal.hideTopmost(result);
  }
}
