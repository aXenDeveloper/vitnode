// @ts-check
import eslint from '@eslint/js';
import tsEslint from 'typescript-eslint';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import perfectionist from 'eslint-plugin-perfectionist';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactPlugin from 'eslint-plugin-react';
import hooksPlugin from 'eslint-plugin-react-hooks';
import reactCompiler from 'eslint-plugin-react-compiler';

export default [
  eslint.configs.recommended,
  ...tsEslint.configs.stylisticTypeChecked,
  ...tsEslint.configs.strictTypeChecked,
  eslintPluginPrettierRecommended,
  jsxA11y.flatConfigs.recommended,
  reactPlugin.configs.flat.recommended,
  perfectionist.configs['recommended-natural'],
  {
    plugins: {
      'react-compiler': reactCompiler,
    },
    rules: {
      'react-compiler/react-compiler': 'error',
    },
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'],
    settings: {
      react: {
        version: 'detect',
      },
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
  {
    plugins: {
      'react-hooks': hooksPlugin,
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      ...hooksPlugin.configs.recommended.rules,
    },
    ignores: ['*.test.tsx'],
  },
  { files: ['**/*.{js,mjs,cjs,jsx,mjsx,ts,tsx,mtsx}'] },
  {
    ignores: [
      'dist',
      'node_modules',
      'eslint.config.mjs',
      'next.config.ts',
      'config/next.config.ts',
      'postcss.config.mjs',
      '.turbo',
      '.next',
      'global.d.ts',
      'tsup.config.ts',
    ],
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
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',
      '@typescript-eslint/no-misused-spread': 'off',
      'perfectionist/sort-decorators': 'warn',
      'perfectionist/sort-modules': 'off',
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
];
