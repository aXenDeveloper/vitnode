# (VitNode) Create App

This package is a CLI tool to create a new VitNode app quickly.

Script based on [Create Next App](https://nextjs.org/).

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

```bash
npx create-vitnode-app@latest
```

or

```bash
pnpm create vitnode-app@latest
```

## Options

| Option              | Description                                                |
| ------------------- | ---------------------------------------------------------- |
| `--package-manager` | Specify the package manager to use. Support `npm`, `pnpm`. |
| `--eslint`          | Initialize with eslint config.                             |
| `--skip-install`    | Skip installing packages after initializing the project.   |
