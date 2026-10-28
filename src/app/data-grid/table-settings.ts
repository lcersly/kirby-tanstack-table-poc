import { Component, computed, inject, signal } from '@angular/core';
import { ButtonComponent } from '@kirbydesign/designsystem/button';
import { NgTemplateOutlet } from '@angular/common';
import { SectionHeaderComponent } from '@kirbydesign/designsystem/section-header';
import { ItemComponent } from '@kirbydesign/designsystem/item';
import { IconComponent } from '@kirbydesign/designsystem/icon';
import { CardComponent } from '@kirbydesign/designsystem/card';
import { PageProgressComponent, PageTitleComponent } from '@kirbydesign/designsystem/page';
import { DropdownComponent } from '@kirbydesign/designsystem/dropdown';
import { SegmentedControlComponent } from '@kirbydesign/designsystem/segmented-control';
import { ToggleComponent } from '@kirbydesign/designsystem/toggle';
import { RadioComponent, RadioGroupComponent } from '@kirbydesign/designsystem/radio';
import {
  CheckboxSize,
  Highlight,
  Container,
  Density,
  DetailMode,
  LoadingMode,
  TableConfig,
  TableConfigService,
  ActionsForce,
  NoActionStatusStyle,
  PresetId,
  PRESETS,
} from './table-config';

type GroupId = 'features' | 'detail' | 'theme' | 'columns' | 'actions' | 'loading' | 'payments' | 'user';

type FeatureKey =
  | 'featureSelect'
  | 'featureQuick'
  | 'featureSearch'
  | 'featureSettings'
  | 'featureSort'
  | 'featureFilter'
  | 'featureRowActions';

interface Option<T> {
  value: T;
  label: string;
}

@Component({
  selector: 'app-table-settings',
  imports: [
    PageTitleComponent,
    DropdownComponent,
    ToggleComponent,
    SegmentedControlComponent,
    NgTemplateOutlet,
    SectionHeaderComponent,
    ButtonComponent,
    ItemComponent,
    IconComponent,
    CardComponent,
    PageProgressComponent,
    RadioComponent,
    RadioGroupComponent,
  ],
  template: `
    <ng-template #selectRow let-title let-options="options" let-key="key">
      <kirby-item>
        <div class="kirby-text-normal">{{ title }}</div>
        <kirby-dropdown
          slot="end"
          class="value"
          [attr.aria-label]="title"
          [items]="labels(options)"
          [selectedIndex]="indexOf(options, valueFor(key))"
          (change)="updateAny(key, valueOf(options, $event))"
        ></kirby-dropdown>
      </kirby-item>
    </ng-template>

    <ng-template #toggleRow let-title let-checked="checked" let-change="change">
      <kirby-item>
        <div class="kirby-text-normal">{{ title }}</div>
        <kirby-toggle slot="end" [attr.aria-label]="title" [checked]="checked" (checkedChange)="change($event)"></kirby-toggle>
      </kirby-item>
    </ng-template>

    <ng-template #pageHeader let-title let-label="label">
      <kirby-section-header>
        <h3 heading>{{ title }}</h3>
<span label>{{ label }}</span>
      </kirby-section-header>
    </ng-template>

    <ng-template #labelHeader let-label>
      <kirby-section-header>
        <span label>{{ label }}</span>
      </kirby-section-header>
    </ng-template>

    @if (group()) {
      <kirby-page-progress>
        <button
          kirby-button
          attentionLevel="3"
          size="md"
          aria-label="Tilbage til alle indstillinger"
          (click)="group.set(null)"
        >
          <kirby-icon name="arrow-back"></kirby-icon>
        </button>
      </kirby-page-progress>
    }
    <kirby-page-title>Udviklerindstillinger</kirby-page-title>
    <div class="content" [class.forward]="group() !== null">
      @switch (group()) {
        @case ('features') {
          <ng-container *ngTemplateOutlet="pageHeader; context: { $implicit: 'Funktioner', label: 'Vælg hvilke funktioner tabellen har' }"></ng-container>
          <kirby-card class="rows">
            @for (f of features; track f.key) {
              <ng-container *ngTemplateOutlet="toggleRow; context: { $implicit: f.title, checked: cfg()[f.key], change: featureSetter(f.key) }"></ng-container>
            }
          </kirby-card>
        }
        @case ('detail') {
          <ng-container *ngTemplateOutlet="pageHeader; context: { $implicit: 'Detaljer', label: 'Vælg hvordan dataobjekternes detaljer skal præsenteres' }"></ng-container>
          <kirby-card class="rows">
            <kirby-radio-group [value]="cfg().detailMode" (valueChange)="update('detailMode', $event)">
              @for (o of detailOptions; track o.value) {
                <kirby-item>
                  <kirby-radio [value]="o.value" [text]="o.label"></kirby-radio>
                </kirby-item>
              }
            </kirby-radio-group>
          </kirby-card>
        }
        @case ('theme') {
          <ng-container *ngTemplateOutlet="pageHeader; context: { $implicit: 'Tema', label: 'Vælg tabellens udseende' }"></ng-container>
          <ng-container *ngTemplateOutlet="labelHeader; context: { $implicit: 'Ramme' }"></ng-container>
          <kirby-card class="rows">
            <ng-container *ngTemplateOutlet="selectRow; context: { $implicit: 'Ramme', options: containerOptions, key: 'container' }"></ng-container>
          </kirby-card>
          <ng-container *ngTemplateOutlet="labelHeader; context: { $implicit: 'Kolonner og rækker' }"></ng-container>
          <kirby-card class="rows">
            <ng-container *ngTemplateOutlet="selectRow; context: { $implicit: 'Tjekbokse', options: checkboxOptions, key: 'checkboxSize' }"></ng-container>
            <ng-container *ngTemplateOutlet="selectRow; context: { $implicit: 'Rækkehøjde', options: densityOptions, key: 'density' }"></ng-container>
            <ng-container *ngTemplateOutlet="toggleRow; context: { $implicit: 'Zebrastriber', checked: cfg().zebra, change: setZebra }"></ng-container>
            <ng-container *ngTemplateOutlet="toggleRow; context: { $implicit: 'Kolonnelinjer', checked: cfg().columnDividers, change: setDividers }"></ng-container>
            <ng-container *ngTemplateOutlet="selectRow; context: { $implicit: 'Fremhævning', options: highlightOptions, key: 'highlight' }"></ng-container>
          </kirby-card>
        }
        @case ('columns') {
          <ng-container *ngTemplateOutlet="pageHeader; context: { $implicit: 'Kolonner', label: 'Vælg hvordan kolonner skal tilpasse sig til viewportens størrelse' }"></ng-container>
          <ng-container *ngTemplateOutlet="labelHeader; context: { $implicit: 'For meget indhold' }"></ng-container>
          <kirby-card class="rows">
            <ng-container *ngTemplateOutlet="toggleRow; context: { $implicit: 'Horisontal rulning', checked: cfg().columnOverflow === 'scroll', change: setScroll }"></ng-container>
            <ng-container *ngTemplateOutlet="toggleRow; context: { $implicit: 'Ombryd', checked: cfg().textHandling === 'wrap', change: setWrap }"></ng-container>
          </kirby-card>
        }
        @case ('user') {
          <ng-container *ngTemplateOutlet="pageHeader; context: { $implicit: 'Brugerkonfiguration', label: 'Vælg hvad brugeren selv må ændre' }"></ng-container>
          <kirby-card class="rows">
            <ng-container *ngTemplateOutlet="toggleRow; context: { $implicit: 'Justere kolonnebredde', checked: cfg().userColumnWidth, change: userSetter('userColumnWidth') }"></ng-container>
            <ng-container *ngTemplateOutlet="toggleRow; context: { $implicit: 'Flytte rundt på kolonner', checked: cfg().userColumnReorder, change: userSetter('userColumnReorder') }"></ng-container>
            <ng-container *ngTemplateOutlet="toggleRow; context: { $implicit: 'Til- og fravælge kolonner', checked: cfg().userColumnChoice, change: setUserChoice }"></ng-container>
            <ng-container *ngTemplateOutlet="toggleRow; context: { $implicit: 'Ændre rækkehøjde', checked: cfg().userDensity, change: userSetter('userDensity') }"></ng-container>
            <ng-container *ngTemplateOutlet="toggleRow; context: { $implicit: 'Til- og fravælge zebrastriber', checked: cfg().userZebra, change: userSetter('userZebra') }"></ng-container>
            <ng-container *ngTemplateOutlet="toggleRow; context: { $implicit: 'Til- og fravælge kolonnelinjer', checked: cfg().userDividers, change: userSetter('userDividers') }"></ng-container>
            <ng-container *ngTemplateOutlet="toggleRow; context: { $implicit: 'Til- og fravælge horisontal rulning', checked: cfg().userScroll, change: userSetter('userScroll') }"></ng-container>
          </kirby-card>
        }
        @case ('actions') {
          <ng-container *ngTemplateOutlet="pageHeader; context: { $implicit: 'Handlinger', label: 'Vælg hvordan handlinger på hver række skal vises' }"></ng-container>
          <kirby-card class="rows">
            <ng-container *ngTemplateOutlet="toggleRow; context: { $implicit: 'Overflow', checked: cfg().actionsOverflow, change: setOverflow }"></ng-container>
          </kirby-card>
          <ng-container *ngTemplateOutlet="labelHeader; context: { $implicit: 'Hvis overflow er slået fra' }"></ng-container>
          <kirby-card class="rows">
            <ng-container *ngTemplateOutlet="selectRow; context: { $implicit: 'Tving visning', options: actionsForceOptions, key: 'actionsForce' }"></ng-container>
          </kirby-card>
        }
        @case ('loading') {
          <ng-container *ngTemplateOutlet="pageHeader; context: { $implicit: 'Indlæsning', label: 'Vælg hvordan rækker hentes og vises' }"></ng-container>
          <kirby-card class="rows">
            <kirby-radio-group [value]="cfg().loading" (valueChange)="update('loading', $event)">
              @for (o of loadingOptions; track o.value) {
                <kirby-item>
                  <kirby-radio [value]="o.value" [text]="o.label"></kirby-radio>
                </kirby-item>
              }
            </kirby-radio-group>
          </kirby-card>
        }
        @case ('payments') {
          <ng-container *ngTemplateOutlet="pageHeader; context: { $implicit: 'Betalingsoversigt', label: 'Vælg hvordan betalingsoversigten skal præsenteres' }"></ng-container>
          <kirby-card class="rows">
            <ng-container *ngTemplateOutlet="toggleRow; context: { $implicit: 'Vis status med flag', checked: cfg().statusStyle === 'flag', change: setStatusFlag }"></ng-container>
            <ng-container *ngTemplateOutlet="selectRow; context: { $implicit: 'Status uden handling', options: noActionOptions, key: 'noActionStatusStyle' }"></ng-container>
            <ng-container *ngTemplateOutlet="toggleRow; context: { $implicit: 'Vis modtagertjek som flag', checked: cfg().checkStyle === 'flag', change: setCheckFlag }"></ng-container>
            <ng-container *ngTemplateOutlet="toggleRow; context: { $implicit: 'Vis flag foran valutakoder', checked: cfg().currencyStyle === 'flag', change: setCurrencyFlag }"></ng-container>
          </kirby-card>
        }
        @default {
          <ng-container *ngTemplateOutlet="pageHeader; context: { $implicit: 'Indstillinger', label: 'Vælg hvordan tabellen skal se ud og fungere' }"></ng-container>
          <ng-container *ngTemplateOutlet="labelHeader; context: { $implicit: 'Hurtigvalg' }"></ng-container>
          <div class="presets">
            <kirby-segmented-control
              mode="chip"
              aria-label="Hurtigvalg"
              [items]="presetItems"
              [selectedIndex]="presetIndex()"
              (selectedIndexChange)="applyPreset(presets[$event].id)"
            ></kirby-segmented-control>
            <button kirby-button attentionLevel="3" size="md" (click)="reset()">Nulstil til standard</button>
          </div>
          <ng-container *ngTemplateOutlet="labelHeader; context: { $implicit: 'Alle indstillinger' }"></ng-container>
          <kirby-card class="rows">
            @for (g of groups; track g.id) {
              <kirby-item [selectable]="true" disclosure="arrow-more" (click)="group.set(g.id)">
                <div class="kirby-text-normal">{{ g.title }}</div>
                <span slot="end" class="kirby-text-small muted">{{ summary(g.id) }}</span>
              </kirby-item>
            }
          </kirby-card>
        }
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .content > * {
      animation: slide-back 240ms ease-out;
    }
    .content.forward > * {
      animation-name: slide-forward;
    }
    @keyframes slide-forward {
      from {
        opacity: 0;
        transform: translateX(32px);
      }
    }
    @keyframes slide-back {
      from {
        opacity: 0;
        transform: translateX(-32px);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .content > * {
        animation: none;
      }
    }
    .content {
      padding: var(--kirby-spacing-s) var(--kirby-spacing-m) var(--kirby-spacing-l);
    }
    kirby-section-header {
      display: block;
      margin-top: var(--kirby-spacing-s);
    }
    kirby-section-header ::ng-deep [label],
    kirby-section-header ::ng-deep [heading] {
      white-space: normal;
    }
    .rows {
      display: block;
      margin-bottom: var(--kirby-spacing-m);
    }
    .rows kirby-item:not(:last-of-type) {
      border-bottom: 1px solid var(--kirby-semi-light);
    }
    .muted {
      color: var(--kirby-text-color-semi-dark);
    }
    .value {
      min-width: 220px;
    }
    .presets {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--kirby-spacing-s);
      margin-bottom: var(--kirby-spacing-l);
    }
  `,
})
export class TableSettingsComponent {
  private readonly service = inject(TableConfigService);

  readonly cfg = this.service.config;
  readonly group = signal<GroupId | null>(null);
  readonly presetItems = [
    { id: 'simple', text: 'Simpel' },
    { id: 'complex', text: 'Avanceret' },
  ];
  /** Markerer det hurtigvalg, som konfigurationen svarer til lige nu */
  readonly presetIndex = computed(() => {
    const c = this.cfg() as unknown as Record<string, unknown>;
    const ids: PresetId[] = ['simple', 'complex'];
    return ids.findIndex((id) =>
      Object.entries(PRESETS[id]).every(([k, v]) => JSON.stringify(c[k]) === JSON.stringify(v)),
    );
  });
  readonly presets: { id: PresetId; title: string }[] = [
    { id: 'simple', title: 'Simpel' },
    { id: 'complex', title: 'Avanceret' },
  ];
  readonly features: { key: FeatureKey; title: string }[] = [
    { key: 'featureSelect', title: 'Vælg flere' },
    { key: 'featureQuick', title: 'Hurtigfiltre' },
    { key: 'featureSearch', title: 'Søgning' },
    { key: 'featureSettings', title: 'Indstillinger' },
    { key: 'featureSort', title: 'Kolonnesortering' },
    { key: 'featureFilter', title: 'Kolonnefiltrering' },
    { key: 'featureRowActions', title: 'Rækkehandlinger' },
  ];
  readonly groups: { id: GroupId; title: string }[] = [
    { id: 'features', title: 'Funktioner' },
    { id: 'detail', title: 'Detaljer' },
    { id: 'theme', title: 'Tema' },
    { id: 'columns', title: 'Kolonner' },
    { id: 'actions', title: 'Handlinger' },
    { id: 'loading', title: 'Indlæsning' },
    { id: 'payments', title: 'Betalingsoversigt' },
    { id: 'user', title: 'Brugerkonfiguration' },
  ];

  summary(id: GroupId): string {
    const c = this.cfg();
    switch (id) {
      case 'features':
        return `${this.features.filter((f) => c[f.key]).length} af ${this.features.length} til`;
      case 'detail':
        return this.labelOf(this.detailOptions, c.detailMode);
      case 'theme':
        return this.labelOf(this.containerOptions, c.container);
      case 'columns':
        return c.columnOverflow === 'scroll' ? 'Rulning' : 'Skjul kolonner';
      case 'actions':
        return c.actionsOverflow ? 'Overflow' : this.labelOf(this.actionsForceOptions, c.actionsForce);
      case 'loading':
        return this.labelOf(this.loadingOptions, c.loading);
      case 'payments': {
        const n = [c.statusStyle === 'flag', c.checkStyle === 'flag', c.currencyStyle === 'flag'].filter(Boolean).length;
        return `${n} med flag`;
      }
      case 'user': {
        const n = [c.userColumnWidth, c.userColumnReorder, c.userColumnChoice, c.userDensity, c.userZebra, c.userDividers, c.userScroll].filter(Boolean).length;
        return `${n} af 7 til`;
      }
    }
  }
  readonly actionsForceOptions: Option<ActionsForce>[] = [
    { value: 'auto', label: 'Dynamisk' },
    { value: 'icon', label: 'Ikonknapper' },
    { value: 'full', label: 'Knapper med ikon og tekst' },
  ];
  readonly noActionOptions: Option<NoActionStatusStyle>[] = [
    { value: 'text', label: 'Normal tekst' },
    { value: 'outline', label: 'Outline-flag' },
  ];
  readonly detailOptions: Option<DetailMode>[] = [
    { value: 'none', label: 'Ingen detaljer' },
    { value: 'side-nonmodal', label: 'Sidepanel (ikke-modalt)' },
    { value: 'side-modal', label: 'Sidepanel (modalt)' },
    { value: 'modal', label: 'Modal' },
    { value: 'inline', label: 'Inline-panel' },
    { value: 'page', label: 'Ny side' },
  ];
  readonly loadingOptions: Option<LoadingMode>[] = [
    { value: 'all', label: 'Alle rækker' },
    { value: 'paging', label: 'Paging' },
    { value: 'lazy', label: 'Lazy load' },
    { value: 'virtual', label: 'Virtual scroll' },
  ];
  readonly containerOptions: Option<Container>[] = [
    { value: 'canvas', label: 'Canvas' },
    { value: 'card', label: 'Hævet kort' },
    { value: 'stroked-card', label: 'Optegnet kort' },
  ];
  readonly densityOptions: Option<Density>[] = [
    { value: 'compact', label: 'Kompakt' },
    { value: 'standard', label: 'Standard' },
    { value: 'spacious', label: 'Luftig' },
  ];
  readonly highlightOptions: Option<Highlight>[] = [
    { value: 'row', label: 'Række' },
    { value: 'cell', label: 'Celle' },
  ];
  readonly checkboxOptions: Option<CheckboxSize>[] = [
    { value: 'xs', label: 'Små' },
    { value: 'md', label: 'Mellem' },
  ];

  labels<T>(options: Option<T>[]): string[] {
    return options.map((o) => o.label);
  }

  indexOf<T>(options: Option<T>[], value: unknown): number {
    return options.findIndex((o) => o.value === value);
  }

  labelOf<T>(options: Option<T>[], value: T): string {
    return options.find((o) => o.value === value)?.label ?? '';
  }

  valueOf<T>(options: Option<T>[], label: string): T {
    return options.find((o) => o.label === label)!.value;
  }

  valueFor(key: string): unknown {
    return this.cfg()[key as keyof TableConfig];
  }

  updateAny(key: string, value: unknown) {
    this.service.set(key as keyof TableConfig, value as never);
  }

  readonly setZebra = (v: boolean) => this.update('zebra', v);
  readonly setDividers = (v: boolean) => this.update('columnDividers', v);
  readonly setScroll = (v: boolean) => this.update('columnOverflow', v ? 'scroll' : 'hide');
  readonly setWrap = (v: boolean) => this.update('textHandling', v ? 'wrap' : 'truncate');
  readonly userSetter = (key: 'userColumnWidth' | 'userColumnReorder' | 'userDensity' | 'userZebra' | 'userDividers' | 'userScroll') =>
    (v: boolean) => this.update(key, v);
  readonly featureSetter = (key: FeatureKey) => (v: boolean) => this.update(key, v);
  applyPreset(id: PresetId) {
    this.service.applyPreset(id);
  }
  readonly setUserChoice = (v: boolean) => this.update('userColumnChoice', v);
  readonly setOverflow = (v: boolean) => this.update('actionsOverflow', v);
  readonly setStatusFlag = (v: boolean) => this.update('statusStyle', v ? 'flag' : 'text');
  readonly setCheckFlag = (v: boolean) => this.update('checkStyle', v ? 'flag' : 'avatar');
  readonly setCurrencyFlag = (v: boolean) => this.update('currencyStyle', v ? 'flag' : 'code');

  update<K extends keyof TableConfig>(key: K, value: TableConfig[K]) {
    this.service.set(key, value);
  }

  reset() {
    this.service.reset();
  }
}
