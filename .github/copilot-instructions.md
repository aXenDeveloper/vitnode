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
- Use UUIDs for all database IDs
- You can find the database schema in the `apps/web/src/database/schema` files
- Respect performance and security best practices when designing the database schema

## TESTING

### VITEST

- Leverage the `vi` object for test doubles - Use `vi.fn()` for function mocks, `vi.spyOn()` to monitor existing functions, and `vi.stubGlobal()` for global mocks. Prefer spies over mocks when you only need to verify interactions without changing behavior.
- Master `vi.mock()` factory patterns - Place mock factory functions at the top level of your test file, return typed mock implementations, and use `mockImplementation()` or `mockReturnValue()` for dynamic control during tests. Remember the factory runs before imports are processed.
- Create setup files for reusable configuration - Define global mocks, custom matchers, and environment setup in dedicated files referenced in your `vitest.config.ts`. This keeps your test files clean while ensuring consistent test environments.
- Use inline snapshots for readable assertions - Replace complex equality checks with `expect(value).toMatchInlineSnapshot()` to capture expected output directly in your test file, making changes more visible in code reviews.
- Monitor coverage with purpose and only when asked - Configure coverage thresholds in `vitest.config.ts` to ensure critical code paths are tested, but focus on meaningful tests rather than arbitrary coverage percentages.
- Make watch mode part of your workflow - Run `vitest --watch` during development for instant feedback as you modify code, filtering tests with `-t` to focus on specific areas under development.
- Explore UI mode for complex test suites - Use `vitest --ui` to visually navigate large test suites, inspect test results, and debug failures more efficiently during development.
- Handle optional dependencies with smart mocking - Use conditional mocking to test code with optional dependencies by implementing `vi.mock()` with the factory pattern for modules that might not be available in all environments.
- Configure jsdom for DOM testing - Set `environment: 'jsdom'` in your configuration for frontend component tests and combine with testing-library utilities for realistic user interaction simulation.
- Structure tests for maintainability - Group related tests with descriptive `describe` blocks, use explicit assertion messages, and follow the Arrange-Act-Assert pattern to make tests self-documenting.
- Leverage TypeScript type checking in tests - Enable strict typing in your tests to catch type errors early, use `expectTypeOf()` for type-level assertions, and ensure mocks preserve the original type signatures.
