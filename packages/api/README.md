# (VitNode) API

`@vitnode/api` is the VitNode server: the Hono API, the database schema
(Drizzle), the Content Engine backend, emails, the WebSocket and Cloudflare
runtimes, and the `vitnode` CLI.

- An API-only app depends on `@vitnode/api` alone.
- A web app depends on `@vitnode/core`, which depends on `@vitnode/api`, and
  lists `@vitnode/api` as a dev dependency for the `vitnode` command.

The built-in plugin keeps its id `@vitnode/core`: endpoints stay under
`/api/@vitnode/core/...` and `fetcher({ plugin: "@vitnode/core" })` calls do
not change.

Docs: https://vitnode.com/docs/dev/architecture#packages

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
