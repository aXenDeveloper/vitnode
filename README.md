<p align="center">
  <a href="https://vitnode.com/" target="_blank">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/VitNode/vitnode/canary/assets/logo/vitnode_logo_dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/VitNode/vitnode/canary/assets/logo/vitnode_logo_light.svg">
      <img alt="VitNode" src="https://raw.githubusercontent.com/VitNode/vitnode/canary/assets/logo/vitnode_logo_light.svg" width="250">
    </picture>
  </a>
</p>

# VitNode

VitNode is a plugin-first framework for community applications. It combines a
TanStack Start front end, Hono API, Postgres, and AdminCP so features can ship as
installable plugins instead of becoming permanent residents of one giant app.

> [!NOTE]
> This is the VitNode 2.0 `canary` branch. It is actively developed, so use the
> docs and source together while it keeps getting sharper.

## Start here

You need Node.js 22+ and Postgres (or Docker). Create an app with the package
manager you use every day:

### Bun

```bash
bun create vitnode-app@canary
```

### pnpm

```bash
pnpm create vitnode-app@canary
```

### npm

```bash
npm create vitnode-app@canary
```

When prompted, choose **Turborepo** if you plan to build plugins. VitNode puts
product pages, APIs, data, translations, and AdminCP extensions in plugins first.

Start local services, migrate, and run the app:

### Bun

```bash
bun run docker:dev
bun run db:migrate
bun dev
```

### pnpm

```bash
pnpm docker:dev
pnpm db:migrate
pnpm dev
```

### npm

```bash
npm run docker:dev
npm run db:migrate
npm run dev
```

Open `http://localhost:3000`, then sign in at `/admin`.

## Build features as plugins

1. [Create a plugin](https://vitnode.com/docs/dev/plugins/create).
2. Give it a route, API module, data model, or AdminCP screen.
3. Register the package in the host app’s configuration.
4. Deploy from the [Start here](https://vitnode.com/docs/dev/deployments/self-hosted) documentation.

The host app owns composition and global infrastructure. The plugin owns the
feature. That boundary pays rent surprisingly quickly.

## Documentation

- [Getting started](https://vitnode.com/docs/dev/setup)
- [Build your first plugin](https://vitnode.com/docs/guides/first-plugin)
- [Plugin routes](https://vitnode.com/docs/dev/plugins/routes)
- [Admin Control Panel](https://vitnode.com/docs/dev/plugins/admin)
- [Content delivery and SEO](https://vitnode.com/docs/dev/content-engine/content-delivery-and-seo)
- [Write documentation](https://vitnode.com/docs/dev/documentation)

## Project scope

- Plugin architecture with TanStack Start routes and typed Hono API modules
- Postgres data models, migrations, search, uploads, and content delivery
- Built-in authentication, roles, staff permissions, i18n, and AdminCP
- Self-hosted and cloud deployment guidance

## License

MIT License
