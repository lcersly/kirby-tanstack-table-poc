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
        @if (avatarSize === 'xs') {
          <kirby-avatar size="xs" class="check-avatar" [class]="color()">
            <kirby-icon [name]="icon()"></kirby-icon>
          </kirby-avatar>
        } @else {
          <span class="avatar xxs" [class]="color()">
            <kirby-icon [name]="icon()"></kirby-icon>
          </span>
        }
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
    .avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background-color: var(--avatar-bg, var(--kirby-semi-light));
      color: var(--avatar-color, var(--kirby-black));

      kirby-icon {
        --kirby-icon-font-size: 16px;
      }
      &.xxs {
        width: 16px;
        height: 16px;

        kirby-icon {
          --kirby-icon-font-size: 12px;
        }
      }
      &.success {
        --avatar-bg: var(--kirby-success-tint);
        --avatar-color: var(--kirby-black);
      }
      &.warning {
        --avatar-bg: var(--kirby-warning-tint);
        --avatar-color: var(--kirby-black);
      }
      &.danger {
        --avatar-bg: var(--kirby-danger-tint);
        --avatar-color: var(--kirby-black);
      }
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
  @Input() avatarSize: 'xs' | 'xxs' = 'xs';

  readonly color = computed<FlagColor>(() => CHECK_COLORS[this.value()]);
  readonly icon = computed(() => CHECK_ICONS[this.value()]);
}
