import eslintVitNode from '@vitnode/eslint-config/eslint';

export default [
  ...eslintVitNode,
  {
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: ['copy-of-vitnode-app'],
  },
];
