# (VitNode) Config

This package provides a default Biome configuration, TypeScript configuration for VitNode projects.

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

### Biome (biome.json)

```json
{
  "$schema": "https://biomejs.dev/schemas/2.2.3/schema.json",
  "extends": ["@vitnode/config/biome"],
  "root": true
}
```

### TypeScript (tsconfig.json)

```json
{
  "extends": "@vitnode/config/tsconfig"
}
```
