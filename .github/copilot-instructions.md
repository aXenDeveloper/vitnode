# VitNode

VitNode is a comprehensive framework designed to simplify and accelerate application development with Next.js and Hono.js. Built as a monorepo solution managed by Turborepo, VitNode provides a structured environment that makes development faster and less complex. The framework includes an integrated AdminCP and plugin system to extend its core functionality.

> **Important:** VitNode is ESM-only (ECMAScript Modules)

## General Guidelines

### Architecture

- TypeScript 5 & React 19
- ESM (ECMAScript Modules) only
- pnpm for package management
- Turborepo for monorepo management
- Respect Prettier (.prettierrc.mjs)
- Respect ESLint (each workspace has eslint.config.mjs) for code formatting and linting
- Respect Typescript rules (each workspace has tsconfig.json)
- Don't use deprecated or outdated features
- Use objects instead of enums in TypeScript

### Core Technologies

**Frontend:**

- **Framework:** Next.js 15
- **Styling:** Tailwind CSS 4
- **UI Components:** Shadcn UI
- **Internationalization:** next-intl 4
- **Icons:** lucide-react 5
- **Schema Validation:** zod 3
- **Form Handling:** react-hook-form 7

**Backend:**

- **Framework**: Hono.js
- **RPC**: Type-safe API calls
- **Documentation**: Fumadocs & Swagger 3
- **Schema validation**: zod 3 & @hono/zod-openapi

### Documentation

- **Framework**: Fumadocs
- Use easy and clear language for documentation to make it accessible to a wide audience
- Use clear and concise examples to illustrate concepts
- Use `// [!code ++]` to highlight code snippets and `// [!code --]` to hide code snippets

### Project Structure

The code is organized into two main directories:

- `apps/web/` - the main frontend application,
  - `apps/web/src/app/[locale]/(main)` - the main application code,
  - `apps/web/src/app/[locale]/admin` - the admin panel code,
- `apps/docs/` - the documentation application
- `packages/vitnode` - the core of the framework, which is used by the `web` application

## FRONTEND

### Architecture Requirements

- Use App Router and Server Components for improved performance and SEO
- Use server actions for form handling and data mutations from Server Components
- Leverage Next.js Image component with proper sizing for core web vitals optimization
- Implement the Metadata API for dynamic SEO optimization
- Use React Server Components for data fetching operations to reduce client-side JavaScript
- Implement Streaming and Suspense for improved loading states
- Use the new Link component without requiring a child `<a>` tag
- Leverage parallel routes for complex layouts and parallel data fetching
- Implement intercepting routes for modal patterns and nested UIs
- Navigation api is in `vitnode/lib/navigation` file. Avoid using `next/navigation` directly

### Internationalization (i18n) - Text Translation

- Use `next-intl` for internationalization
- Use `t('key')` for translation keys
- Languages keys should be added in `apps/web/src/plugins/core/langs/{lang_key}.ts` file
- Use `getTranslation` function for server component but `useTranslation` for client

## BACKEND

### Development Guidelines

- Write backend code in `packages/vitnode/src/api` directory
- Generate OpenAPI documentation using `@hono/zod-openapi` for all API endpoints

### Database

- Use `PostgreSQL` with `Drizzle ORM`
- Use `t.serial().primaryKey()` for all database IDs
- You can find the database schema in the `apps/web/src/database/schema` files
- Respect performance and security best practices when designing the database schema

### API

- For get current user use `c.get('user')` in Hono.js context or `c.get('deviceId')` for device ID
- If you need to implement pagination, use `withPagination()` function from `packages/vitnode/src/api/lib/with-pagination.ts` file
- Each API endpoint should be implement in `pakcages/vitnode/src/api/modules` directory and each module should have its own directory
