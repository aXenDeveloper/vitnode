// @ts-check
import eslint from '@eslint/js';
import tsEslint from 'typescript-eslint';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import perfectionist from 'eslint-plugin-perfectionist';

export default [
  eslint.configs.recommended,
  ...tsEslint.configs.stylisticTypeChecked,
  ...tsEslint.configs.strictTypeChecked,
  eslintPluginPrettierRecommended,
  perfectionist.configs['recommended-natural'],
  { files: ['**/*.{js,mjs,cjs,jsx,mjsx,ts,tsx,mtsx}'] },
  {
    ignores: ['tsup.config.ts', 'codegen.ts'],
  },
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
      },
    },
  },
  {
    rules: {
      'perfectionist/sort-switch-case': 'warn',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      'perfectionist/sort-named-exports': 'warn',
      'perfectionist/sort-enums': 'warn',
      'perfectionist/sort-exports': 'warn',
      '@typescript-eslint/no-dynamic-delete': 'off',
      'perfectionist/sort-named-imports': 'warn',
      'perfectionist/sort-intersection-types': 'warn',
      'perfectionist/sort-interfaces': 'warn',
      'perfectionist/sort-union-types': 'warn',
      'perfectionist/sort-object-types': 'warn',
      'perfectionist/sort-jsx-props': 'warn',
      'perfectionist/sort-imports': 'warn',
      '@typescript-eslint/no-unsafe-call': 'off',
      'perfectionist/sort-objects': 'off',
      'perfectionist/sort-classes': [
        'warn',
        {
          groups: [
            'constructor',
            'static-block',
            'index-signature',
            'static-property',
            ['protected-property', 'protected-accessor-property'],
            ['private-property', 'private-accessor-property'],
            ['property', 'accessor-property'],
            'static-method',
            'protected-method',
            'private-method',
            'method',
            ['get-method', 'set-method'],
            'unknown',
          ],
        },
      ],
      'no-console': 'error',
      'consistent-return': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          ignoreRestSiblings: false,
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-useless-constructor': 'off',
      '@typescript-eslint/prefer-readonly': 'warn',
      '@typescript-eslint/require-array-sort-compare': 'error',
      '@typescript-eslint/promise-function-async': 'error',
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/no-unnecessary-qualifier': 'error',
      '@typescript-eslint/no-useless-empty-export': 'error',
      '@typescript-eslint/method-signature-style': 'warn',
      'newline-before-return': 'warn',
      'no-restricted-imports': [
        'error',
        {
          name: 'next/link',
          message: 'Please import from `vitnode-frontend/navigation` instead.',
        },
        {
          name: 'drizzle-orm/mysql-core',
          message: 'Please import from `drizzle-orm/pg-core` instead.',
        },
        {
          name: 'next/navigation',
          importNames: [
            'redirect',
            'permanentRedirect',
            'useRouter',
            'usePathname',
          ],
          message: 'Please import from `vitnode-frontend/navigation` instead.',
        },
      ],
    },
  },
  {
    ignores: [
      'dist',
      'node_modules',
      'eslint.config.mjs',
      '.turbo',
      '.next',
      'global.d.ts',
    ],
  },
];
