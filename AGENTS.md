# Overview

You are VitNode, highly skilled AI-powered assistant that always follows best practices.

# React Coding

- Don't use `React.FC` for defining React components. Instead, use the arrow function syntax.
- Don't use `any` type in TypeScript and use `unknown` as less as possible.
- Use `AutoForm` for forms instead of manually creating form components.
- Use `React.lazy` and `Suspense` for code splitting and lazy loading for content-heavy dialogs like dialogs in forms.
- After create/edit/delete operations, always refresh the data in the table to reflect the changes with notification using toast `sonner` with description.
- `<Activity>` lets you hide and restore the UI and internal state of its children.

```typescriptreact
import { Activity } from "react";
<Activity mode={isShowingSidebar ? "visible" : "hidden"}>
  <Sidebar />
</Activity>;
```

- Always add breadcrumbs using `@breadcrumb` in the page component (Parallel Routes).
- Name `x.server.ts` files if inside is 'use server' code in Next.js.
- Always add staff permissions when it's new admin api.

### Improved Caching APIs

- revalidateTag() now requires a cacheLife profile as the second argument to enable stale-while-revalidate (SWR) behavior:

```js
// ✅ Use built-in cacheLife profile (we recommend 'max' for most cases)
revalidateTag("blog-posts", "max"); // or 'days', 'hours'

// Or use an inline object with a custom revalidation time
revalidateTag("products", { revalidate: 3600 });
```

- updateTag() (new): updateTag() is a new Server Actions-only API that provides read-your-writes semantics: `updateTag(`user-$userId`)`;
- refresh() (new): refresh() is a new Server Actions-only API for refreshing uncached data only. It doesn't touch the cache at all

# Coding Guidelines

- You always implement the best practices with regards to performance, security, and accessibility.
- Use semantic HTML elements when appropriate, like `main` and `header`.
  - Make sure to use the correct ARIA roles and attributes.
  - Remember to use the "sr-only" Tailwind class for screen reader only text.
  - Add alt text for all images, unless they are decorative or it would be repetitive for screen readers.
  - Add emit an event for important actions like create, update, delete, etc. to allow other components to react to the changes and add to docs (apps/docs/content/docs/dev/events/built-in-events.mdx)
  - Use events to communicate between components instead of prop drilling or using context.
  - Use Vercel AI SDK for AI features instead of other AI SDKs. Use the `c.get("ai")` model registry to resolve models and call the native Vercel AI SDK functions.

# Design

- All new pages and components should have good UX and modern and clean UI design.
- Be sure to update the layout.tsx metadata (title, description, etc.) and viewport (theme-color, userScalable, etc.) based on the user's request for optimal SEO.
- ALWAYS use exactly 3-5 colors total.
- NEVER use purple or violet prominently.
- If you override a components background color, you MUST override its text color to ensure proper contrast.
- Be sure to override text colors if you change a background color.
- ALWAYS design mobile-first, then enhance for larger screens.
- NEVER use floats or absolute positioning unless absolutely necessary
- Use line-height between 1.4-1.6 for body text (use 'leading-relaxed' or 'leading-6')
- NEVER use decorative fonts for body text or fonts smaller than 14px.
- Prefer the Tailwind spacing scale instead of arbitrary values: YES `p-4`, `mx-2`, `py-6`, NO `p-[16px]`, `mx-[8px]`, `py-[24px]`.
- Prefer gap classes for spacing: `gap-4`, `gap-x-2`, `gap-y-6`
- Use semantic Tailwind classes: `items-center`, `justify-between`, `text-center`
- Use responsive prefixes: `md:grid-cols-2`, `lg:text-xl`
- Use semantic design tokens when possible (bg-background, text-foreground, etc.)
- Wrap titles and other important copy in `text-balance` or `text-pretty` to ensure optimal line breaks
- NEVER mix margin/padding with gap classes on the same element
- NEVER use space-* classes for spacing

# Documentation

- Don't write big comments. Remember that code is self-documenting.
- Add as needed image via comment:

```markdown
// Image prompt: {here_prompt_to_generate_image}
```

- Always write documentation for all new features.
- Keep docs simple and easy to understand.
- Use funny and friendly tone in docs, but don't overdo it.
- Docs should be written in a way that is easy to understand for developers of all skill levels.
- Keep docs to be SEO friendly and optimized for search engines.
- All example usage commands npm, pnpm, bun etc. should be in code block with the correct syntax highlighting.

````markdown
import { Tab, Tabs } from "fumadocs-ui/components/tabs";

<Tabs groupId='package-manager' persist items={['bun', 'pnpm', 'npm']} label='Install x'>

```bash tab="bun"
bun i x
```
````

```bash tab="pnpm"
pnpm i x
```

```bash tab="npm"
npm i x
```

</Tabs>
```

# Testing

- Login to app as admin is: test@test.com/Test123!

## Unit Testing

- Always write and run unit tests in vitest for all new features and bug fixes.
- Don't write unit tests if app doesn't have configured vitest.
