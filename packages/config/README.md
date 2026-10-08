# (VitNode) Config

This package provides a default Oxlint configuration, TypeScript configuration, and Oxfmt configuration for VitNode projects.

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

### Oxlint (oxlint.config.ts)

Install `oxlint` and `oxlint-tsgolint`, then extend the shared config. Add `@vitnode/config/oxlint.react` for React projects.

```ts
import vitnode, { ignorePatterns } from "@vitnode/config/oxlint";
import vitnodeReact from "@vitnode/config/oxlint.react";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [vitnode, vitnodeReact],
  ignorePatterns: [...ignorePatterns, ".output/**"],
});
```

`ignorePatterns` are not inherited through `extends`, so spread the exported list into your own.

Run it with type-aware rules enabled:

```json
{
  "scripts": {
    "lint": "oxlint --type-aware",
    "lint:fix": "oxlint --type-aware --fix"
  }
}
```

### TypeScript (tsconfig.json)

```json
{
  "extends": "@vitnode/config/tsconfig"
}
```

### Oxfmt (oxfmt.config.ts)

Install `oxfmt`, then spread the shared config. Oxfmt is a Prettier-compatible formatter, minus the waiting.

```ts
import vitnode from "@vitnode/config/oxfmt";
import { defineConfig } from "oxfmt";

export default defineConfig({
  ...vitnode,
  ignorePatterns: [".output", "dist"],
});
```

No Prettier plugins needed: Tailwind class sorting is built in (`sortTailwindcss`, including classes inside `cn()`).

```json
{
  "scripts": {
    "format": "oxfmt",
    "format:check": "oxfmt --check"
  }
}
```
