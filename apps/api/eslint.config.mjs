import eslintVitNode from '@vitnode/eslint-config/eslint';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default [
  ...eslintVitNode,
  {
    ignores: ['drizzle.config.ts'],
  },
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
  },
];
