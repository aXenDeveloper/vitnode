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

## FRONTEND

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
- Use `next-intl` for internationalization and localization
- Languages keys should be added in `apps/web/src/plugins/core/langs/{lang}.ts` file first to avoid type errors
- Use always this package for translations _(Don't left any plain text in the code)_

## DOCS

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

## BACKEND

- **Framework**: Hono.js
- **RPC**: Type-safe API calls
- **Documentation**: Fumadocs & Swagger 3
- **Schema validation**: zod 3 & @hono/zod-openapi
- **Database**: PostgreSQL with Drizzle ORM
- Use UUIDs for all database IDs

## Architecture

- TypeScript 5 & React 19
- ESM (ECMAScript Modules) only
- pnpm for package management
- Turborepo for monorepo management
- Respect Prettier & ESLint for code formatting and linting

## Project Structure

The code is organized into two main directories:

### Apps

- `apps/web/` - the main frontend application,
- `apps/docs/` - the documentation application

### Packages

- `packages/eslint/` - custom ESLint configuration with Typescript,
- `packages/vitnode/` - shared components for `web/` project to create frontend & backend
