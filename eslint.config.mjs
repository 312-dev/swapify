import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // Unused vars: allow underscore-prefixed intentionally unused params
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // No explicit any — force proper typing
      '@typescript-eslint/no-explicit-any': 'warn',
      // Enforce const over let when no reassignment
      'prefer-const': 'error',
      // No var
      'no-var': 'error',
      // Strict equality
      eqeqeq: ['error', 'always'],
      // Warn on large files
      'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
    },
  },
]);

export default eslintConfig;
