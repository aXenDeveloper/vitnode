# VitNode AI Coding Agent Guidelines (Extended)

## Architecture & Key Patterns

- **Monorepo Structure:**
  - `apps/` contains main apps (`api` for backend, `docs` for docs site)
  - `packages/` holds shared code, core framework, ESLint/Prettier configs, and CLI tools
  - `plugins/` for extendable features
- **Frontend:**
  - Next.js 15, App Router, Server Components
  - Use `vitnode/lib/navigation` for navigation (not `next/navigation`)
  - Forms: Use `react-hook-form@7`, server actions for mutations
  - UI: Shadcn UI, Tailwind CSS 4, dark/light mode with system detection
  - i18n: Use `next-intl`, `t('key')` for translations, `getTranslation` (server), `useTranslation` (client)
  - Accessibility: WCAG 2.1 AA, semantic HTML, ARIA, keyboard/screen reader support
- **Backend:**
  - Hono.js 4, OpenAPI via `@hono/zod-openapi`, Zod 4 for validation
  - Database: PostgreSQL via Drizzle ORM, access via `c.get('database')`
  - API: RESTful, versioned, rate-limited, secure session management
  - Error handling: Use Hono's error middleware, log via `c.get('log')`
  - Plugins: Register via `VitNodeAPI` config, routes auto-mounted by pluginId
- **Docs:**
  - Written in `.mdx` using Fumadocs, main entry: `apps/docs/content/docs/dev/index.mdx`
  - Use `// [!code ++]` to highlight code, `// [!code --]` to hide
  - No h1 tags, no emoji in headings

## Developer Workflow

- **Package Manager:** Use `pnpm` for all installs/scripts
- **Scripts:**
  - `pnpm dev` (dev server), `pnpm build`, `pnpm lint`, `pnpm db:push`, `pnpm db:migrate`, `pnpm docker:dev`
- **CLI:**
  - Create apps/plugins via `pnpm create vitnode-app@canary` (see `packages/create-vitnode-app`)
  - CLI prompts for package manager, app mode, ESLint, Docker, install (see `questions.ts`)
- **Linting/Formatting:**
  - Use configs from `packages/eslint/`
  - File names: snake_case, ESModule only
  - TypeScript 5 strict mode
- **Testing:**
  - Use Vitest (see `vitest.config.ts`)
- **Config:**
  - Centralized in `vitnode.config.ts` and `api/config.ts`
  - Extend via plugins in config arrays

## Integration & Conventions

- **External:**
  - Next.js, Hono.js, Drizzle ORM, Zod, react-hook-form, Shadcn UI, Tailwind, next-intl
- **Internal:**
  - Navigation, config, API, middleware, plugin system
- **Security:**
  - XSS protection, content security policy, secure cookies

## Examples

- See `apps/api/src/index.ts` for backend API setup
- See `packages/vitnode/src/api/config.ts` for API registration and middleware
- See `packages/vitnode/src/lib/navigation.ts` for navigation API
- See `apps/docs/next.config.ts` for docs site config

---

For unclear or missing patterns, ask for clarification or request more examples from maintainers.
