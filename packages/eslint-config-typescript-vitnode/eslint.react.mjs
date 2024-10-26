// @ts-check
import eslintVitNodeFrontend from './eslint.frontend.mjs';
import reactPlugin from 'eslint-plugin-react';
import globals from 'globals';
import reactCompiler from 'eslint-plugin-react-compiler';

export default [
  ...eslintVitNodeFrontend,
  {
    plugins: {
      'react-compiler': reactCompiler,
    },
    rules: {
      'react-compiler/react-compiler': 'error',
    },
  },
  {
    ...reactPlugin.configs.flat.recommended,
    languageOptions: {
      ...reactPlugin.configs.flat.recommended.languageOptions,
      globals: {
        ...globals.serviceworker,
        ...globals.browser,
      },
    },
    rules: {
      'react-hooks/exhaustive-deps': 'off',
      'react/no-unknown-property': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/jsx-no-target-blank': 'off',
    },
  },
  {
    ignores: ['.next', 'global.d.ts', 'next.config.ts', 'next.config.mjs'],
  },
];
