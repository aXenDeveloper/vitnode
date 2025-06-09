# VitNode Development Guidelines

VitNode is a comprehensive framework designed to simplify and accelerate application development with Next.js and Hono.js. Built as a monorepo solution managed by Turborepo, VitNode provides a structured environment that makes development faster and less complex. The framework includes an integrated AdminCP and plugin system to extend its core functionality.

## Global Rules

- Write ESModule only
- Always use snake_case for file names
- Use pnpm as package manager
- Use Zod 3 for schema validation
- Use react-hook-form 7 for forms
- Use Shadcn UI & Tailwind CSS 4 for UI
- Respect Prettier configuration in `packages/eslint/prettierrc.mjs` and ESLint configuration in `packages/eslint/eslint.config.mjs`
- Use TypeScript 5, React 19 & Hono.js 4

## Frontend Development (Next.js & React)

- Use Next.js 15
- Use App Router and Server Components
- Use server actions for form handling and data mutations from Server Components
- Leverage Next.js Image component with proper sizing for core web vitals optimization
- Navigation API is in `vitnode/lib/navigation` file. Avoid using `next/navigation` directly
- Alert Dialog & Dialog content should always have title and description with React lazy loading content

### Internationalization (i18n)

- Use `next-intl` for internationalization
- Use `t('key')` for translation keys
- Use `getTranslation` function for server components but `useTranslation` for client components

## Backend Development (Hono.js)

- Use @hono/zod-openapi or Zod 3 for schema validation
- Use PostgreSQL with Drizzle ORM
- Use `t.serial().primaryKey()` for all database IDs
- To get access to database, use `c.get('database')` by Hono.js context

## Documentation (\*.mdx files)

- Use Fumadocs framework
- Write docs in `.mdx` files
- `apps/docs/content/docs/dev/index.mdx` contains the main documentation
- Use easy, clear and funny language for documentation to make it accessible to a wide audience (exclude title and description)
- Use clear and concise examples to illustrate concepts
- Use `// [!code ++]` to highlight code snippets and `// [!code --]` to hide code snippets
- Don't add h1 tag in markdown
- Don't use emoji on headings
