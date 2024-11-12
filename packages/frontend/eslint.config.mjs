// @ts-check
import eslintVitNode from 'eslint-config-typescript-vitnode/eslint.react.mjs';

export default [
  ...eslintVitNode,
  {
    ignores: ['next.config.d.ts'],
  },
];
