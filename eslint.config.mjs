import eslint from '@eslint/js';
import angular from 'angular-eslint';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
  },
  {
    // Data Grid er en prototype med klikbare rækker og Kirby-menuer; reglerne slækkes kun her
    files: ['src/app/data-grid/**/*.ts', 'src/app/data-grid/**/*.html'],
    rules: {
      '@angular-eslint/no-output-native': 'off',
      '@angular-eslint/template/click-events-have-key-events': 'off',
      '@angular-eslint/template/interactive-supports-focus': 'off',
      '@angular-eslint/template/role-has-required-aria': 'off',
    },
  },
  {
    files: ['**/*.mjs'],
    extends: [eslint.configs.recommended],
  },
  {
    ignores: [
      'dist/**',
      '.angular/**',
      'node_modules/**',
      'src/app/prototype/demo-commit.generated.ts',
    ],
  },
);
