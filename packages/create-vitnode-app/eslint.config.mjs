import eslintVitNode from 'eslint-config-typescript-vitnode/eslint';

export default [
  ...eslintVitNode,
  {
    rules: {
      'no-console': 'off',
    },
  },
];
