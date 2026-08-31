# (VitNode) Create App

This package is a CLI tool to create a new VitNode app quickly.

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

It scaffolds a [TanStack Start](https://tanstack.com/start) application on Vite
with the [Hono](https://hono.dev) API mounted at `/api/*`, Drizzle over
PostgreSQL, and `use-intl` for translations.

> The CLI's prompt-and-scaffold flow was originally modelled on `create-next-app`.
> The output has not been a Next.js app since VitNode 2.0.

## Usage

```bash
npx create-vitnode-app@latest
```

or

```bash
pnpm create vitnode-app@latest
```

or

```bash
bun create vitnode-app@latest
```

## Options

| Option              | Description                                                                       |
| ------------------- | --------------------------------------------------------------------------------- |
| `--package-manager` | Specify the package manager to use. Support `npm`, `pnpm`.                        |
| `--eslint`          | Initialize with ESLint & Prettier config.                                         |
| `--skip-install`    | Skip installing packages after initializing the project.                          |
| `--mode`            | Specify the type of app to create. Support `singleApp`, `apiMonorepo`, `onlyApi`. |
| `--monorepo`        | Create project with monorepo structure.                                           |
| `--docker`          | Initialize with Docker support.                                                   |
| `--plugin`          | Create a VitNode plugin project.                                                  |

## What you get

A `singleApp` - the frontend and the API in one process:

```txt
src/
├── routes/                 one file per URL this app owns
│   ├── __root.tsx          the document, the providers, the 404
│   ├── _main.tsx           the public site shell
│   ├── _admin.tsx          the AdminCP shell
│   └── api/$.ts            the Hono API, mounted
├── lib/                    page-head, i18n, auth and admin wiring
├── locales/                this app's own translation overrides
├── router.tsx              mounts VitNode's own screens onto your tree
├── vitnode.config.ts       which plugins are installed
├── vitnode.shell.config.ts the site's name, locales and theme
└── vitnode.api.config.ts   the API: database, plugins, adapters
```

`apiMonorepo` splits the API into its own workspace; `onlyApi` scaffolds the API
alone.

Start it with `pnpm dev`. Every app that owns a schema prepares the database -
generate pending migrations, apply them, seed initial data - before its dev
server accepts a request, so there is nothing to run first.

## Create Plugin

Use the `--plugin` flag to create a VitNode plugin project. Run it from the root
of your monorepo.

```txt
plugins/my-plugin/
└── src/
    ├── config.tsx           registers the plugin
    ├── locales/
    │   ├── en.json          the strings the page renders
    │   └── index.ts         the barrel config.tsx registers
    └── routes/
        ├── manifest.ts      declares one route at /my-plugin
        └── home-page.tsx    what it renders
```

Add the plugin to your app's `src/vitnode.config.ts` `plugins` array and the page
is live. A **route module** plus a **manifest entry** is the whole contract:
there is no host page wrapper to write, no copy of your page in the app, and no
router to import in the module itself.

### Options

| Option           | Description                                              |
| ---------------- | -------------------------------------------------------- |
| `--skip-install` | Skip installing packages after initializing the project. |
