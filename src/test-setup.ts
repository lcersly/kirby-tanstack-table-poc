import { vi } from 'vitest';

vi.mock('@kirbydesign/designsystem/segmented-control', async () => {
  const { Component, input, output } = await import('@angular/core');

  class MockSegmentedControlComponent {
    readonly items = input<readonly unknown[]>([]);
    readonly selectedIndex = input(0);
    readonly mode = input('chip');
    readonly size = input('sm');
    readonly segmentSelect = output<{ id: string; text: string }>();
  }
  Component({
    selector: 'kirby-segmented-control',
    template: '',
  })(MockSegmentedControlComponent);

  return { SegmentedControlComponent: MockSegmentedControlComponent };
});

vi.mock('@kirbydesign/designsystem/dropdown', async () => {
  const { Component, forwardRef } = await import('@angular/core');
  const { NG_VALUE_ACCESSOR } = await import('@angular/forms');

  class MockDropdownComponent {
    items: string[] = [];
    placeholder = '';
    hasError = false;
    private onChange: (value: string) => void = () => {};
    writeValue(): void {}
    registerOnChange(fn: (value: string) => void): void {
      this.onChange = fn;
    }
    registerOnTouched(): void {}
    onItemSelect(index: number): void {
      this.onChange(this.items[index] ?? '');
    }
  }
  Component({
    selector: 'kirby-dropdown',
    template: '',
    inputs: ['items', 'placeholder', 'hasError'],
    providers: [
      {
        provide: NG_VALUE_ACCESSOR,
        useExisting: forwardRef(() => MockDropdownComponent),
        multi: true,
      },
    ],
  })(MockDropdownComponent);

  return { DropdownComponent: MockDropdownComponent };
});
