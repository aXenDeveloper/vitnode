# Create VitNode App

`create-vitnode-app` scaffolds a TanStack Start and Hono VitNode application,
or an installable plugin for an existing VitNode workspace.

<p align="center">
  <a href="https://vitnode.com/" target="_blank">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/VitNode/vitnode/canary/assets/logo/vitnode_logo_dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/VitNode/vitnode/canary/assets/logo/vitnode_logo_light.svg">
      <img alt="VitNode" src="https://raw.githubusercontent.com/VitNode/vitnode/canary/assets/logo/vitnode_logo_light.svg" width="400">
    </picture>
  </a>
</p>

## Create an app

### Bun

```bash
bun create vitnode-app@latest
```

### pnpm

```bash
pnpm create vitnode-app@latest
```

### npm

```bash
npm create vitnode-app@latest
```

Choose Turborepo during setup if you will build plugins. It gives your project a
workspace root and a `plugins/*` home.

## Create a plugin

Run this from an existing VitNode workspace, then enter the plugin package name
when prompted:

### Bun

```bash
bun create vitnode-app@latest --plugin
```

### pnpm

```bash
pnpm create vitnode-app@latest --plugin
```

### npm

```bash
npm create vitnode-app@latest -- --plugin
```

The generator creates the package and adds its workspace dependency. Enable the
feature by registering it in the host’s `vitnode.config.ts`:

```ts
import { myPlugin } from '@acme/my-plugin/config'

plugins: [myPlugin()]
```

## Options

| Option | Description |
| --- | --- |
| `--package-manager` | Choose `npm` or `pnpm` for the generated project. |
| `--eslint` | Include ESLint and Prettier configuration. |
| `--skip-install` | Skip dependency installation after scaffolding. |
| `--mode` | Choose `singleApp`, `apiMonorepo`, or `onlyApi`. |
| `--monorepo` | Create a workspace layout for plugins and multiple applications. |
| `--docker` | Include local Docker services. |
| `--plugin` | Create a VitNode plugin package. |

Read the [VitNode documentation](https://vitnode.com/docs/dev) for setup,
plugins, deployment, and AdminCP guides.
