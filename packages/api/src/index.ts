/**
 * `@vitnode/api` - the VitNode server: the Hono API, the database schema, the
 * Content Engine backend, emails and the `vitnode` CLI.
 *
 * This root entry is side-effect free and holds only the most common symbols.
 * The API factory is `VitNodeAPI` from `@vitnode/api/config`; everything else
 * has its own subpath (`@vitnode/api/lib/plugin`, `@vitnode/api/database/*`,
 * `@vitnode/api/content/server`, ...).
 *
 * The built-in plugin keeps the logical id `@vitnode/core` - in endpoints
 * (`/api/@vitnode/core/...`), `fetcher({ plugin: "@vitnode/core" })`,
 * permissions, events and database rows - although its code ships here.
 */
export type { BuildPluginApiReturn } from "./lib/plugin";
export { manifest } from "./manifest";
export type { VitNodeApiPlugin } from "./plugin";
export { buildApiConfig } from "./vitnode.config";
export type { VitNodeApiConfig } from "./vitnode.config";
