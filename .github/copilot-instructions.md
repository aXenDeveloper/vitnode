# VitNode AI Coding Agent Guidelines (Extended)

The repository is a monorepo for the VitNode framework: a Hono API, a TanStack Start web application that also serves the documentation, and shared packages. The stack is TanStack Start + TanStack Router + TanStack Query on the front, Hono 4 + Drizzle on the back.

- Do not nest ternary operators.

## Architecture & Key Patterns

- **Monorepo Structure:**
  - `apps/` contains main apps (`web` for the site, AdminCP, mounted API and
    documentation; `api` for deploying the backend on its own, and it owns
    `migrations/`)
  - `packages/` holds shared code, core framework, ESLint and Prettier configs, and CLI tools
  - `plugins/` for extendable features
- **Frontend:**
  - TanStack Start on Vite, file-based routes under `apps/web/src/routes/`
  - Route files are topology only - `validateSearch`, `loaderDeps`, `loader`,
    `head`, `staticData`. The query, the permissions, the namespaces and the
    screen live in `@vitnode/core/tanstack/*`
  - Write `head` **after** `loader` in the same object literal - `loaderData` is
    inferred from `loader`, and TypeScript reads members in order
  - Navigation: use `@vitnode/core/tanstack/layout`'s `RouterLink`, or TanStack
    Router's own `Link` / `useNavigate`. Never hand-build a locale prefix
  - Data: a route `loader` warms a TanStack Query entry with `ensureQueryData`,
    the component reads the same options object back with `useSuspenseQuery`,
    and a mutation invalidates exactly the entry it changed
  - Forms: `AutoForm` first; `react-hook-form@7` underneath it
  - UI: Shadcn UI on Base UI, Tailwind CSS 4, dark/light mode with system detection
  - i18n: Use `use-intl`, `t('key')` for translations, `createTranslator`
    (server), `useTranslations` (client)
  - Accessibility: WCAG 2.1 AA, semantic HTML, ARIA, keyboard/screen reader support
- **Backend:**
  - Hono 4, OpenAPI via `@hono/zod-openapi`, Zod 4 for validation
  - Database: PostgreSQL via Drizzle ORM, access via `c.get('db')`
  - API: RESTful, versioned, rate-limited, secure session management
  - Error handling: Use Hono's error middleware, log via `c.get('log')`
  - Plugins: Register via `buildApiPlugin`, routes auto-mounted by `pluginId`
- **Plugins:**
  - A plugin route is a **route module** plus an entry in the plugin's
    `src/routes/manifest.ts`. There is no host page wrapper and no copy of the
    page in `apps/web` - the app's Vite plugin generates a literal `import()`
    per entry into `src/plugin-routes.gen.ts`
  - A plugin route module imports **no router**. `@vitnode/core/routing` (data
    and types), `use-intl` and plain JSX are the whole allowance
  - Loader, metadata, breadcrumb and search parsing go in the module's `route`
    export (`definePluginRoute`); the manifest stays plain data
  - Dynamic segments are `:slug` in a manifest, `$slug` in an app route file
  - A plugin route module renders no `<main>` - the shell owns that landmark
- **Docs:**
  - Written in `.mdx` using Fumadocs, main entry: `apps/web/content/docs/dev/index.mdx`
  - Use `// [!code ++]` to highlight code, `// [!code --]` to hide
  - No h1 tags, no emoji in headings

## Developer Workflow

- **Package Manager:** Use `pnpm` for all installs/scripts
- **Scripts:**
  - `pnpm dev` - builds the CLI scripts, builds the plugins, prepares the
    database, then starts every app
  - `pnpm build`, `pnpm build:plugins`, `pnpm start`
  - `pnpm db:prepare` - generate pending migrations, apply them, seed initial
    data. `pnpm db:migrate` runs the same three steps under the name
    deployments use
  - `pnpm docker:dev` - start the local PostgreSQL container
- **CLI:**
  - Create apps/plugins via `pnpm create vitnode-app@canary` (see `packages/create-vitnode-app`)
  - CLI prompts for package manager, app mode, ESLint, Prettier, Docker, install (see `questions.ts`)
- **Linting/Formatting:**
  - Use configs from `packages/config/`
  - File names: kebab-case, ESModule only
  - TypeScript strict mode
- **Testing:**
  - Use Vitest (see `vitest.config.ts`). Prefer pure, static and type-level
    tests over ones that need a database or a rendered UI
- **Config:**
  - `src/vitnode.config.ts` (app + plugins), `src/vitnode.api.config.ts` (API)
  - Extend via plugins in config arrays
- **Generated files - never hand-edit:**
  - `apps/web/src/routeTree.gen.ts` (TanStack Router),
    `plugin-route-manifest.gen.ts`, `plugin-routes.gen.ts`,
    `admin-nav.gen.ts`, `content-registry.gen.ts` (VitNode's Vite plugin),
    `apps/web/.source/` (Fumadocs), every package's `dist/`
  - They are rewritten on every `vite dev` and `vite build`. Change the input -
    a plugin's manifest, `src/vitnode.config.ts`, a package's `src/locales/*.json`
  - They are committed, and a stale one fails a test: run `pnpm dev`, then commit

## Integration & Conventions

- **External:**
  - TanStack Start, TanStack Router, TanStack Query, Hono, Drizzle ORM, Zod, react-hook-form, Shadcn UI, Tailwind, use-intl, Fumadocs
- **Internal:**
  - Navigation, config, API, middleware, plugin system
- **Security:**
  - **Hono is the security boundary.** A route guard is navigation - it saves
    someone a wasted page load. Every read and write is authorized in the API,
    from the session cookie, on every request
  - XSS protection, content security policy, secure cookies

## Examples

- See `apps/api/src/index.ts` for backend API setup
- See `apps/web/src/routes/api/$.ts` for the API mounted into the web app
- See `packages/vitnode/src/api/config.ts` for API registration and middleware
- See `packages/vitnode/src/tanstack/layout/router-link.tsx` for the navigation API
- See `plugins/example/src/routes/manifest.ts` for a fully commented route manifest
- See `apps/web/source.config.ts` and `apps/web/src/docs/` for docs site config

---

For unclear or missing patterns, ask for clarification or request more examples from maintainers.

## New Code

If you add new code or change existing code, always verify that
everything still works by running _each_ of the following checks:

1. `pnpm lint` to run the linter.
2. `pnpm lint:fix` to fix any linting issues.
3. `pnpm test` to run the tests.
4. `pnpm test:types` to run the type-level tests.

Complete the task only after all checks pass.
