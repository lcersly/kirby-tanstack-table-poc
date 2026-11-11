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
        <kirby-avatar size="xs" class="check-avatar" [class.dense]="avatarSize !== 'xs'" [class.xxs]="avatarSize === 'xxs'" [class.md]="avatarSize === 'md'" [class]="color()">
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
    // [OPEN POINT: Kirby har ingen avatar på 20 og 24 px. Kompakt er 20 px, standard 24 px og luftigt 28 px, firkantet med 4 px afrunding]
    .check-avatar.dense.xs ::ng-deep .avatar {
      width: 24px;
      height: 24px;
      padding: 0;
      overflow: hidden;
      border-radius: 4px !important;
      --kirby-icon-font-size: 16px;
    }
    .check-avatar.dense.xs.md ::ng-deep .avatar {
      width: 28px;
      height: 28px;
      --kirby-icon-font-size: 18px;
    }
    .check-avatar.dense.xs.xxs ::ng-deep .avatar {
      width: 20px;
      height: 20px;
      border-radius: 4px !important;
      --kirby-icon-font-size: 14px;
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
  @Input() flagSize: 'xs' | 'sm' | 'md' = 'xs';
  @Input() avatarSize: 'xs' | 'sm' | 'xxs' | 'md' = 'xs';

  readonly color = computed<FlagColor>(() => CHECK_COLORS[this.value()]);
  readonly icon = computed(() => CHECK_ICONS[this.value()]);
}
