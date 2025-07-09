import eslintVitNode from '@vitnode/eslint-config/eslint';

export default [
  ...eslintVitNode,
  {
    ignores: ['drizzle.config.ts'],
  },
];
