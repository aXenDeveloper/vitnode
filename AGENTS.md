# Overview

You are VitNode, an expert AI coding assistant. Follow repository conventions and best practices for performance, security, accessibility, UX, and SEO.

Account test:
login: test@test.com
pass: Test123!

# React / TanStack Start

- Arrow functions for components - never `React.FC`.
- No `any`; use `unknown` as rarely as possible.
- Use `AutoForm` for forms instead of hand-built form components.
- `React.lazy` + `Suspense` for content-heavy dialogs (e.g. dialogs in forms).
- After create/edit/delete: refresh the table data and show a `sonner` toast with a description.
- `<Activity>` hides and restores children's UI and internal state:

```typescriptreact
import { Activity } from "react";

<Activity mode={isShowingSidebar ? "visible" : "hidden"}>
  <Sidebar />
</Activity>;
```

- Add a breadcrumb with the route's `staticData.breadcrumb`; a crumb that renders strings needs its own `RouteMessages`.
- Route files are topology only - `validateSearch`, `loaderDeps`, `loader`, `head`, `staticData`. The query, the permissions, the namespaces and the screen live in `@vitnode/core/tanstack/*`.
- Write `head` **after** `loader` in the same object literal: `loaderData` is inferred from `loader`, and TypeScript reads members in order.
- Name files `x.server.ts` when they must never reach the browser bundle.
- A package may declare `createIsomorphicFn` but never `createServerFn` - uncompiled on the server, its handler silently resolves to `undefined`. Server functions belong to the host app.
- New admin APIs always require staff permissions.

### Caching APIs

- Client and SSR caching is TanStack Query. Invalidate with `queryClient.invalidateQueries` after a write; warm a route's data in its `loader` with `ensureQueryData`.
- Server-side domain caching is the API's own: `c.get("cache")` in a Hono route, Redis-backed when `REDIS_URL` is set and a no-op otherwise.
- Content Engine tag builders live in `content/cache.ts` (`contentPublicListTag` and friends) - pure strings, used to expire a content type's cached reads.
- A background mutation cannot expire a front end's cache by calling a function. `dispatchContentRevalidation` posts to the origins an install opts into via `content.revalidateOrigins`.

# Coding Guidelines

- Always implement best practices for performance, security, and accessibility.
- Semantic HTML (`main`, `header`) with correct ARIA roles/attributes, `sr-only` for screen-reader-only text, and alt text on all images unless decorative or repetitive.
- Emit events for important actions (create, update, delete) so other components can react; use events instead of prop drilling or context. Document them in `apps/web/content/docs/dev/events/built-in-events.mdx`.
- AI features use the Vercel AI SDK only - resolve models via the `c.get("ai")` registry and call native SDK functions.

# Design

- New pages and components need good UX and a modern, clean UI. Design mobile-first, then enhance for larger screens.
- Update `layout.tsx` metadata (title, description) and viewport (theme-color, userScalable) for SEO.
- Exactly 3–5 colors total. Never use purple or violet prominently.
- If you override a background color, you MUST override its text color for contrast.
- Prefer semantic design tokens (`bg-background`, `text-foreground`).
- Use the Tailwind spacing scale (`p-4`, `mx-2`) - never arbitrary values (`p-[16px]`).
- Use `gap-*` classes for spacing. Never use `space-*`, and never mix margin/padding with gap on the same element.
- Use semantic (`items-center`, `justify-between`) and responsive (`md:grid-cols-2`) classes.
- No floats or absolute positioning unless absolutely necessary.
- Body text: `leading-relaxed` (1.4–1.6), never below 14px, never decorative fonts.
- Wrap titles and important copy in `text-balance` or `text-pretty`.

# Documentation

- Document every new feature. Keep it simple, SEO-friendly, and understandable at any skill level.
- Friendly and lightly funny tone - don't overdo it.
- Skip big comments; code is self-documenting.
- Request images with a comment: `// Image prompt: {here_prompt_to_generate_image}`
- Put install commands in tabbed code blocks with correct syntax highlighting:

````markdown
import { Tab, Tabs } from "fumadocs-ui/components/tabs";

<Tabs groupId='package-manager' persist items={['bun', 'pnpm', 'npm']} label='Install x'>

```bash tab="bun"
bun i x
```

```bash tab="pnpm"
pnpm i x
```

```bash tab="npm"
npm i x
```

</Tabs>
````

# Testing

- Write and run vitest unit tests for all new features and bug fixes - skip only if vitest isn't configured.
- Don't write tests:
  - for trivial code unless they have complex logic or edge cases
  - for tests where it uses a database or external API
  - how UI should be rendered (use playwright for that to write e2e tests)
