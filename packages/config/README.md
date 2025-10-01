# (VitNode) ESLint Config

This package provides a default ESLint configuration, TypeScript configuration, and Prettier configuration for VitNode projects.

<p align="center">
  <br>
  <a href="https://vitnode.com/" target="_blank">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/VitNode/vitnode/canary/assets/logo/vitnode_logo_dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/VitNode/vitnode/canary/assets/logo/vitnode_logo_light.svg">
      <img alt="VitNode Logo" src="https://raw.githubusercontent.com/VitNode/vitnode/canary/assets/logo/vitnode_logo_light.svg" width="400">
    </picture>
  </a>
  <br>
  <br>
</p>

## Usage

### ESLint (eslint.config.mjs)

```js
import eslintVitNode from "@vitnode/config/eslint";

export default [...eslintVitNode];
```

### TypeScript (tsconfig.json)

```json
{
  "extends": "@vitnode/config/tsconfig"
}
```

### Prettier (.prettierrc.mjs)

```js
import vitnodePrettier from "@vitnode/config/prettierrc";

/**
 * @see https://prettier.io/docs/en/configuration.html
 * @type {import("prettier").Config}
 */
const config = {
  ...vitnodePrettier,
};

export default config;
```
