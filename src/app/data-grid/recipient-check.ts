import { Component, Input, computed, signal } from '@angular/core';
import { AvatarComponent } from '@kirbydesign/designsystem/avatar';
import { FlagComponent } from '@kirbydesign/designsystem/flag';
import { IconComponent } from '@kirbydesign/designsystem/icon';
import { CHECK_COLORS, CHECK_ICONS, FlagColor, RecipientCheck } from './payments';

/**
 * Modtagertjek vist enten som et flag med ikon foran teksten
 * eller som tekst med en rund avatar (farvet baggrund og ikon) foran.
 */
@Component({
  selector: 'app-recipient-check',
  imports: [AvatarComponent, FlagComponent, IconComponent],
  template: `
    @if (asFlag) {
      <kirby-flag [size]="flagSize" [themeColor]="color()">
        <span class="content"><kirby-icon [name]="icon()"></kirby-icon>{{ check }}</span>
      </kirby-flag>
    } @else {
      <span class="content">
        <kirby-avatar size="xs" class="check-avatar" [class.dense]="avatarSize !== 'xs'" [class]="color()">
          <kirby-icon [name]="icon()"></kirby-icon>
        </kirby-avatar>
        {{ check }}
      </span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      white-space: nowrap;
    }
    .content {
      display: inline-flex;
      align-items: center;
      gap: var(--kirby-spacing-xxs);
    }
    kirby-icon {
      --kirby-icon-font-size: 1.25em;
    }
    .check-avatar {
      --kirby-avatar-color: var(--kirby-black);
      --kirby-avatar-background-color: var(--kirby-semi-light);
      &.success {
        --kirby-avatar-background-color: var(--kirby-success-tint);
      }
      &.warning {
        --kirby-avatar-background-color: var(--kirby-warning-tint);
      }
      &.danger {
        --kirby-avatar-background-color: var(--kirby-danger-tint);
      }
    }
    // [OPEN POINT: Kirby har ingen xxs-avatar; i kompakt og standard er avataren lige så høj som et xs-flag (20 px), mens ikonet beholder Luftigs størrelse]
    .check-avatar.dense ::ng-deep .avatar {
      width: 20px;
      height: 20px;
      padding: 0;
      overflow: visible;
    }
  `,
})
export class RecipientCheckComponent {
  private readonly value = signal<RecipientCheck>('Match');

  @Input({ required: true }) set check(v: RecipientCheck) {
    this.value.set(v);
  }
  get check(): RecipientCheck {
    return this.value();
  }
  @Input() asFlag = true;
  @Input() flagSize: 'xs' | 'sm' = 'xs';
  @Input() avatarSize: 'xs' | 'sm' | 'xxs' = 'xs';

  readonly color = computed<FlagColor>(() => CHECK_COLORS[this.value()]);
  readonly icon = computed(() => CHECK_ICONS[this.value()]);
}
