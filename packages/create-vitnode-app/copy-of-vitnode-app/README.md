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

# VitNode App

This is a basic template for a [VitNode](https://vitnode.com/) app.

## Getting Started

To get started, run the following commands:

```bash
pnpm i
```

Open {{START_URLS}} with your browser to see the result.

## Development

To start the development server, you need to create a `.env` file from the provided `.env.example` file.

In the `development` environment, you can just copy and paste the content of `.env.example` to `.env`.

### Development server

To start the development server, run the following command:

```bash
pnpm dev
```

## Configuration

Two files, and the line between them is one question: may a browser hold this?

| File                           | Holds                                                                                                                    |
| :----------------------------- | :----------------------------------------------------------------------------------------------------------------------- |
| `src/vitnode.config.ts`        | locales, metadata, theme, `debug`, enabled plugin ids - plain data, read by the browser, the server, and your Vite build |
| `src/vitnode.server.config.ts` | message loaders - server only                                                                                            |

Add a language to `i18n.locales` in the shared config; register the files that
translate it in `src/locales/packages.ts` (a package's own translations) or
`src/locales/app.ts` (your rewordings). `pnpm vitnode i18n:create de Deutsch`
does all three.

`src/start.ts` is one call to `createVitNodeStart`, which installs CSRF
protection for server functions, canonical locale redirects with the
remembered-locale cookie, and the `private, no-store` directive every rendered
document needs. Add your own request middleware with `requestMiddleware` - it
runs after all of it.

See [Configuration](https://vitnode.com/docs/dev/configuration).
