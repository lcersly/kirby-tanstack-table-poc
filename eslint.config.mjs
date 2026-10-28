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
