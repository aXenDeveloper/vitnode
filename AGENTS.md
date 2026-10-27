# Overview

You are VitNode, an expert AI coding assistant. Follow repository conventions and best practices for performance, security, accessibility, UX, and SEO.

Account test with admin permissions:
login: test@test.com
pass: Test123!

# React / TanStack Start

- Arrow functions for components - never `React.FC`.
- No `any`; use `unknown` as rarely as possible.
- Use `AutoForm` for forms instead of hand-built form components.
- Use `React.lazy` + `Suspense` for content-heavy dialogs (e.g. dialogs in forms).
- Pick the editing surface by the size of the settings:
  - **Sheet** for short settings - a handful of fields about one thing (an AI action, the AI settings). Scrollable body plus `AutoFormSheetFooter` from `@vitnode/core/components/form/auto-form-sheet-footer`; close the sheet after a successful save.
  - **Dialog** for bigger settings - several sections or tabs (a role's settings). Lazy-load the form.
  - **Page** for the biggest - a full editor with its own navigation and preview (editing an article).
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

### Loading feedback

Pick one indicator per piece of pending work, by what is pending:

- **Route navigation → top progress bar.** `NavigationProgress` (`packages/vitnode/src/tanstack/pending/navigation-progress.tsx`) is mounted once by `VitNodeRootProviders` - never render a second one or a page-level spinner for a navigation. It follows the router's lifecycle (`isRouteNavigating` / `useIsRouteNavigating` in `tanstack/pending/navigation-pending.ts`), so redirects, errors, superseded navigations, preloads, `router.invalidate()` and query refetches are already handled; never drive it with timers.
- **Keep the shell and the current page.** The router runs with `defaultPendingMs: Infinity`: header, sidebar and the page being left stay visible and usable until the destination commits. Don't add `pendingMs` to a route to swap it for a skeleton, and don't blank a breadcrumb or layout while navigating.
- **Section loading → a local skeleton.** Lists, profiles, cards, widgets and lazy dialogs whose data is not awaited in the loader get a `<Suspense>` (or `isPending`) fallback shaped like the final content - the shapes in `@vitnode/core/tanstack/pending` (`FeedPendingSkeleton`, `TablePendingSkeleton`, `CardsPendingSkeleton`, `FormPendingSkeleton`, `ProfilePendingSkeleton`…) or `Skeleton` from `@vitnode/core/components/ui/skeleton` with the same sizes as the real rows. Scope it to that section; a route's `pendingComponent` is its suspense fallback, not navigation feedback.
- **Refetches keep the data.** Branch on `isPending` (first load), never `isFetching`, for placeholders. Use `placeholderData: keepPreviousData` for queries keyed on search, filters or pages, and mark the stale view with `aria-busy={isFetching}` and at most a dim (`opacity-60`).
- **Actions → the control's own loading state.** Submissions and mutations use `<Button isLoading>` (disables the button, keeps its width, sets `aria-busy`); `AutoForm` and `ConfirmAction` already do it. Track pending for every async handler (`isPending`, `useActionState`, or a `try/finally` flag) and disable sibling actions that would conflict, so nothing can be sent twice. No page-level overlay for an action.
- **Accessibility and motion.** A loading region has `aria-busy` and one sr-only `role="status"` label (`PendingFrame` does both); decorative skeleton blocks are `aria-hidden` (`Skeleton` is by default) and a spinner inside labelled text is `aria-hidden`. Animate only `transform`/`opacity` and respect `prefers-reduced-motion` (`motion-safe:`/`motion-reduce:`).

### Fetching APIs

- `fetcher` from `@vitnode/core/tanstack/fetcher` is universal - one call, SSR and browser. Never hand-write `createIsomorphicFn().server(...).client(...)` for a fetch.
- A call names the plugin, never an API module: `fetcher({ plugin: "@vitnode/core", method: "get", module: "users", path: "/devices" })`. `plugin`, `module` (any nesting depth, `admin/advanced/cron`), `path`, `method`, `args` and the response are all inferred from the plugin API registry; an invalid combination is a compile error at the offending property.
- The registry is `ApiPluginRegistry` in `@vitnode/core/lib/fetcher/registry`. Core registers itself; an app's `src/api-registry.gen.ts` registers every configured plugin that exports `config.api`, with type-only imports; `vitnode build`/`vitnode dev` write a plugin's own entry to its `types/api-registry.gen.d.ts` (kept out of the published package) so its pages can call it. Never import a plugin API factory as a value outside `vitnode.api.config.ts`.
- `@vitnode/core/tanstack/fetcher/server` is for work that is genuinely server-only: server functions, `allowSaveCookies` cookie relay, cron/jobs, upstream secrets or a different `origin`. Same call shape, more options.
- Shared `views/*` query modules call `fetcher` directly - no injected transport, no browser-only twin. `@vitnode/core/lib/fetcher-client` is the framework-neutral browser primitive the universal fetcher is built on, for code that never renders on a server.
- Write the route inline at the call site - never build a request object elsewhere and pass it in.
- Never annotate the result; the fetcher infers it. Put the shared contract on the feature's own `*Fetcher` type instead.
- `args` is required exactly when the route declares a body, params or a query.
- `captchaToken` for captcha-gated routes.
- `rawFetcher` only for generated Content Engine admin modules, which have no type to infer from. It is universal too, with the same server-only twin. A content type's _public_ routes are typed: `module: "content/<publicApi.path>"`.

### Caching APIs

- Client and SSR caching is TanStack Query. Invalidate with `queryClient.invalidateQueries` after a write; warm a route's data in its `loader` with `queryClient.query({ ...options, staleTime: "static" })` (`infiniteQuery` for a feed). `ensureQueryData`, `fetchQuery` and `prefetchQuery` are deprecated - `query` replaces all three.
- Server-side domain caching is the API's own: `c.get("cache")` in a Hono route, Redis-backed when `REDIS_URL` is set and a no-op otherwise.
- Content Engine tag builders live in `content/cache.ts` (`contentPublicListTag` and friends) - pure strings, used to expire a content type's cached reads.
- A background mutation cannot expire a front end's cache by calling a function. `dispatchContentRevalidation` posts to the origins an install opts into via `content.revalidateOrigins`.

# Coding Guidelines

- Always implement best practices for performance, security, and accessibility.
- Semantic HTML (`main`, `header`) with correct ARIA roles/attributes, `sr-only` for screen-reader-only text, and alt text on all images unless decorative or repetitive.
- Emit events for important actions (create, update, delete) so other components can react; use events instead of prop drilling or context. Document them in `apps/web/content/docs/dev/events/built-in-events.mdx`.
- APIs return i18n keys, never translated text, for anything the UI shows (titles, descriptions, labels a plugin registers). The web translates them with `use-intl`, so the text follows the UI's language and the cached response works in every language. Translate on the server only for output with no UI, such as emails.
- AI features use the Vercel AI SDK only - resolve models via the `c.get("ai")` registry and call native SDK functions.

# Design

- New pages and components need good UX and a modern, clean UI. Design mobile-first, then enhance for larger screens.
- Update `layout.tsx` metadata (title, description) and viewport (theme-color, userScalable) for SEO.
- Exactly 3–5 colors total. Never use purple or violet prominently.
- If you override a background color, you MUST override its text color for contrast.
- Prefer semantic design tokens (`bg-background`, `text-foreground`).
- Every action button gets a `lucide-react` icon before its label (`aria-hidden`) - Save, Delete, Reply, Share, Try again, Sign in, submit buttons and confirm buttons in dialogs. The only exception is Cancel (and other dismiss buttons that just close something).
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
- Docs call the VitNode API with `fetcher` (`rawFetcher` for generated Content Engine admin routes), never raw `fetch` or a browser-console snippet. A check that needs a request with no UI yet uses a small temporary component with a button.
- Never end a page with a "Next step" (or "Next", "What's next") section; the sidebar and page footer link the following page. Use `## Related` for links worth following.
- Developer-facing APIs in feature code (exports of `@vitnode/core` and plugins that app or plugin authors call) need concise English JSDoc on the original declaration:
  - Say what it is for, plus constraints, side effects, runtime (server-only, browser-only or universal) and `@throws` only when they are real and non-obvious.
  - Document configuration properties one by one, including non-obvious defaults and constraints.
  - Give major entry points a minimal `@example` with real imports.
  - A behavior change updates the JSDoc in the same change. Keep tutorials in the MDX docs.
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

- Never write unit tests in the same session. Spawn a new session, and write the test after the feature is working. Tests are for regression, not for development.
- UI component tests (`*.test.tsx`) should test DOM output, click events, and dialogs. Never test CSS classes, inline styles that only decorate, or form UI (`AutoForm`, form fields).
- Always run "pnpm lint:fix" to fix formatting and linting issues before committing. Never commit a file with lint errors.

### What not to test

- An existing feature applied somewhere new. Building the widgets system earns tests; adding widget zones or widgets to another page or plugin does not, because the mechanism is already covered and only the wiring is new. The same goes for a route that only calls a tested helper, or a boot step that only calls a tested validator.
- Database models or schema definitions (Drizzle tables, column types, indexes, foreign keys, RLS), or the SQL text Drizzle generates.
- Static config, constants, color presets, plugin configuration (`config.api`, content type definitions), query-key literals, namespace lists, TanStack Query option values (`retry`, `staleTime`) and route `staticData`.
- Third-party libraries or trivial helper/wrapper code. A shadcn or Base UI wrapper does not earn a test for what Base UI already does (stepping a `NumberField`, a `Tooltip` delay, a `Progress` aria value).
- Source text. No `readFileSync` + `toContain`/`toMatch` on a module, no "this file still exists" or "this identifier is gone" checks - test behaviour. Import-graph checks that keep server or editor code out of a bundle are fine.
- Translated copy or the contents of a locale JSON - `use-intl` renders keys in tests, so assert on the key.
- The test's own fixtures.

### One behaviour, one test

- Test a rule once, in the layer that owns it: a pure function in its own file, a service in the service test, HTTP status, permissions and events in the route test. Don't re-assert the same rule through a wrapper, a route or a rendered screen.
- Before adding a case, search for the behaviour - if another file already asserts it, extend that file instead of copying the scenario.
- Prefer a pure-function test to a render. A DOM test costs about 15× a node test; render only to check what the user sees or clicks.
- Collapse near-identical cases into one `it.each` table instead of a run of copy-pasted `it`s.
- Content Engine route permissions go in `content/server/permission-matrix.test.ts`, not as allowed/403 pairs in every route file.
- Security checks stay even when they look redundant: cookie scoping, auth ceremonies (origin, RP ID, replayed challenges), timing-safe paths, open-redirect guards and per-route `403`s.

### Speed

- The file name picks the environment: `*.test.tsx` runs in happy-dom (project `dom`), `*.test.ts` runs in node (project `unit`). Never add a `// @vitest-environment` pragma.
- `unit` shares one module graph per worker (`isolate: false`). A test that asserts process-wide state ("nothing registered yet") goes in `ISOLATED` in `packages/vitnode/vitest.config.ts`.
- Real builds, watchers and child processes go in `INTEGRATION` there. `pnpm test` runs everything; `pnpm test:unit` skips them.
- Never wait out a real delay - use `vi.useFakeTimers()` and advance the clock.
- Build a Hono app or a fixture once per file when the tests only read from it.

### Mocking

- Avoid `vi.mock`. It swaps a whole module for the file, so the test stops exercising the real code and breaks silently when the module is renamed or reshaped. Reach for a real seam first:
  - a value on the Hono context: `c.set("db" | "cache" | "admin" | "events", fake)` in a test middleware;
  - a global: `vi.stubGlobal("fetch", ...)`, `vi.stubGlobal("matchMedia", ...)`;
  - an object or instance: `vi.spyOn(model, "method")`;
  - a prop, a provider, or a function argument.
- `vi.mock` is allowed only as a last resort, for a boundary with no seam (a `React.lazy` editor, a child process). Never use it for a module the test could drive for real.
- Staff permissions: grant them with `grantStaffPermissions` from `@/tests/staff-permissions` on a `createTestCache()` from `@/tests/cache`, set as `c.set("cache", cache)`. Never mock `check-staff-permission`. Assert on the response (`200` with the permission, `403` without), not on which permission was asked for.
- `use-intl` is mocked once for every test in `packages/vitnode/src/tests/setup.ts`: `t("key")` renders `namespace.key`. Don't mock it per file.
