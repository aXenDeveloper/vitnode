# AI Rules for VitNode

VitNode is a comprehensive framework designed to simplify and accelerate application development with Next.js and Hono.js. Built as a monorepo solution managed by Turborepo, VitNode provides a structured environment that makes development faster and less complex. The framework includes an integrated AdminCP and plugin system to extend its core functionality.

# VitNode Technology Stack

- **Frontend (Web)**: Next.js 15 with Tailwind CSS 4 and Shadcn UI components
- **Backend (API)**: Hono.js with RPC for type-safe API calls
- **Database**: PostgreSQL
- **Documentation**: Fumadocs & Swagger 3
- **Build System**: Turborepo for monorepo management
- **CI/CD**: GitHub Actions for automated testing, building, and deployment
- ESM (ECMAScript Modules) only

## Frontend

- **Framework**: Next.js 15
- **Styling**: Tailwind CSS 4
- **UI Components**: Shadcn UI
- **Internationalization**: next-intl 4
- **Icons**: lucide-react 5
- **Schema Validation**: zod 3
- **Form Handling**: react-hook-form 7

- Use App Router and Server Components for improved performance and SEO
- Use server actions for form handling and data mutations from Server Components
- Leverage Next.js Image component with proper sizing for core web vitals optimization
- Implement the Metadata API for dynamic SEO optimization
- Use React Server Components for {{data_fetching_operations}} to reduce client-side JavaScript
- Implement Streaming and Suspense for improved loading states
- Use the new Link component without requiring a child <a> tag
- Leverage parallel routes for complex layouts and parallel data fetching
- Implement intercepting routes for modal patterns and nested UIs
- Navigation api is in `vitnode/lib/navigation` file. Avoid using `next/navigation` directly

### Internationalization (i18n) - Text Translation

- Use `next-intl` for internationalization
- Use `t('key')` for translation keys
- Languages keys should be added in `apps/web/src/plugins/core/langs/{lang_key}.ts` file
- Use `getTranslation` function for server component but `useTranslation` for client

## Documentation

- **Framework**: Fumadocs
- Use easy and clear language for documentation to make it accessible to a wide audience
- Use clear and concise examples to illustrate concepts

### Component Paths

#### Shadcn UI components

| Component     | Path for `apps/web/`                  | Path for `packages/vitnode`     |
| ------------- | ------------------------------------- | ------------------------------- |
| Alert         | `vitnode/components/ui/alert`         | `@/components/ui/alert`         |
| Button        | `vitnode/components/ui/button`        | `@/components/ui/button`        |
| Card          | `vitnode/components/ui/card`          | `@/components/ui/card`          |
| Checkbox      | `vitnode/components/ui/checkbox`      | `@/components/ui/checkbox`      |
| Drawer        | `vitnode/components/ui/drawer`        | `@/components/ui/drawer`        |
| Dropdown Menu | `vitnode/components/ui/dropdown-menu` | `@/components/ui/dropdown-menu` |
| Form          | `vitnode/components/ui/form`          | `@/components/ui/form`          |
| Input         | `vitnode/components/ui/input`         | `@/components/ui/input`         |
| Label         | `vitnode/components/ui/label`         | `@/components/ui/label`         |
| Separator     | `vitnode/components/ui/separator`     | `@/components/ui/separator`     |
| Sheet         | `vitnode/components/ui/sheet`         | `@/components/ui/sheet`         |
| Skeleton      | `vitnode/components/ui/skeleton`      | `@/components/ui/skeleton`      |
| Sonner        | `vitnode/components/ui/sonner`        | `@/components/ui/sonner`        |
| Tooltip       | `vitnode/components/ui/tooltip`       | `@/components/ui/tooltip`       |
| Collapsible   | `vitnode/components/ui/collapsible`   | `@/components/ui/collapsible`   |

#### Other UI components

| Component | Path for `apps/web/`           | Path for `packages/vitnode` |
| --------- | ------------------------------ | --------------------------- |
| Loader    | `vitnode/components/ui/loader` | `@/components/ui/loader`    |

#### Other components

| Component    | Path for `apps/web/`              | Path for `packages/vitnode` |
| ------------ | --------------------------------- | --------------------------- |
| Avatar       | `vitnode/components/avatar`       | `@/components/avatar`       |
| Logo Vitnode | `vitnode/components/logo-vitnode` | `@/components/logo-vitnode` |

## Backend

- **Framework**: Hono.js
- **RPC**: Type-safe API calls
- **Documentation**: Fumadocs & Swagger 3
- **Schema validation**: zod 3 & @hono/zod-openapi

## Database

- Use `PostgreSQL` with `Drizzle ORM`
- Use UUIDs for all database IDs
- You can find the database schema in the `apps/web/src/database/schema` files
- Respect performance and security best practices when designing the database schema

## Architecture

- TypeScript 5 & React 19
- ESM (ECMAScript Modules) only
- pnpm for package management
- Turborepo for monorepo management
- Respect Prettier (.prettierrc.mjs)
- Respect ESLint (each workspace has eslint.config.mjs) for code formatting and linting
- Respect Typescript rules (each workspace has tsconfig.json)
- Don't use deprecated or outdated features
- Use objects instead of enums in TypeScript

## Project Structure

The code is organized into two main directories:

### Apps

- `apps/web/` - the main frontend application,
  - `apps/web/src/app/[locale]/(main)` - the main application code,
  - `apps/web/src/app/[locale]/admin` - the admin panel code,
- `apps/docs/` - the documentation application

### Packages

- `packages/eslint/` - custom ESLint configuration with Typescript,
- `packages/vitnode/` - shared components for `web/` project to create frontend & backend
