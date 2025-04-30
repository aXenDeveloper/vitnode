# VitNode Test Plan

## 1. Introduction

This document outlines the testing strategy for the VitNode framework. The goal is to ensure the reliability, functionality, and performance of the core framework (`packages/vitnode`), the web application (`apps/web`), and associated plugins. We will utilize Vitest for unit and integration testing and Playwright for end-to-end testing.

## 2. Goals

- Ensure core framework features function as expected ([.github/docs/prd.md](.github/docs/prd.md)).
- Verify the stability and correctness of the AdminCP and user-facing application.
- Validate authentication (credentials, SSO: Google, GitHub, Facebook), authorization, and permission systems.
- Confirm database interactions and schema integrity.
- Ensure the plugin system allows for seamless extension of functionality (new pages, API endpoints, AdminCP pages, SSO providers, email providers).
- Maintain high code quality and prevent regressions.
- Achieve performance and accessibility targets ([.github/docs/prd.md](.github/docs/prd.md)).

## 3. Testing Tools

- **[Vitest](https://vitest.dev/):** For unit and integration tests. Chosen for its speed, ESM support, and compatibility with the Vite ecosystem (used by Next.js) and Hono.js.
- **[Playwright](https://playwright.dev/):** For end-to-end tests. Chosen for its cross-browser capabilities, reliability, and features like auto-waits and tracing.

## 4. Types of Tests

### 4.1. Unit Tests (Vitest)

**Scope:** Test individual functions, components, and utilities in isolation.
**Location:** Primarily within `packages/vitnode` and utility directories in `apps/web`.

**Areas to Cover:**

- **Core Utilities:** Functions in `packages/vitnode/src/lib`, helpers, etc.
- **API Helpers:** Route building, validation logic using `@hono/zod-openapi`.
- **UI Components:** Basic rendering tests, prop validation for components in `packages/vitnode/src/components` and `apps/web/src/components`.
- **Configuration Loading:** Ensure `vitnode.config.ts` is loaded and parsed correctly.
- **Internationalization (i18n):** Test translation loading and formatting utilities.

### 4.2. Integration Tests (Vitest)

**Scope:** Test the interaction between different modules or layers of the application.
**Location:** Test files adjacent to the features they cover (e.g., API routes, server actions).

**Areas to Cover:**

- **API Endpoints:** Test request handling, validation, middleware execution, and response generation for Hono.js routes defined in `packages/vitnode/src/api`. Example: [`testRoute`](packages/vitnode/src/api/modules/users/routes/test.route.ts).
- **Server Actions:** Test form submissions, data mutations, and interactions with the database within `apps/web`.
- **Database Interactions:** Verify Drizzle ORM queries, schema interactions, and data integrity (using a test database).
- **Authentication Logic:** Test credential verification, session creation/validation (including durations), email verification, password reset, and SSO provider interactions (Google, GitHub, Facebook).
- **Plugin Integration:** Test how core systems interact with plugin-provided extensions (routes, hooks, etc.).

### 4.3. End-to-End Tests (Playwright)

**Scope:** Simulate real user scenarios by interacting with the application through a browser.
**Location:** A dedicated `e2e` or `tests` directory at the root or within `apps/web`.

**Areas to Cover:**

- **Authentication Flows:**
  - User registration
  - Login with credentials
  - Login with SSO providers (Google, GitHub, Facebook - as defined in [.github/docs/prd.md](.github/docs/prd.md))
  - Password reset flow
  - Email verification flow
  - Logout
- **AdminCP Functionality:**
  - Navigating the AdminCP interface
  - User Management: Create, Read, Update, Delete (CRUD) users, search, filter ([.github/docs/prd.md](.github/docs/prd.md))
  - Role Management: CRUD roles and assign permissions ([.github/docs/prd.md](.github/docs/prd.md))
  - Plugin Management (if applicable)
  - Viewing system settings/information
- **Main Application Flows:**
  - Navigating public pages
  - User profile updates (password, email, avatar)
  - Content interaction (e.g., viewing blog posts if `plugins/blog` is enabled)
- **Plugin-Specific Flows:** E2E tests for critical user journeys introduced by plugins.
- **Responsiveness:** Basic checks across different viewport sizes.
- **Accessibility:** Automated accessibility checks using Playwright's integrations to meet WCAG 2.1 guidelines.

## 5. Test Environment

- **Database:** A separate PostgreSQL database instance for testing, managed via Docker ([docker-compose.yml](docker-compose.yml)). Schema pushed using `pnpm db:push`.
- **Environment Variables:** A specific `.env.test` file or equivalent mechanism for test-specific configurations (e.g., database connection strings, API keys for test accounts).
- **Seeding:** Scripts to seed the test database with necessary initial data (roles, languages, default users, permissions, etc.) before test runs.

## 6. Running Tests

- **Unit/Integration:** `pnpm test` or specific Vitest commands targeting files/directories. (Note: `README.md` lists `pnpm test` but not specific unit/integration scripts yet).
- **End-to-End:** `pnpm test:e2e` (script to be defined). Playwright command to run the E2E test suite.
- **All Tests:** `pnpm test` (script to be defined, potentially running both Vitest and Playwright suites).

## 7. CI/CD Integration

- Tests will be automatically executed on pull requests and pushes to the main branch using GitHub Actions ([.github/workflows/](.github/workflows/)).
- Test results and coverage reports will be generated and made available.
- Failing tests will block merging/deployment as per CI/CD configuration ([.github/docs/prd.md](.github/docs/prd.md)).
- CI/CD pipeline includes linting, formatting, security scanning, build checks, and potentially deployment steps.

## 8. Reporting

- Test results will be reported in the CI/CD pipeline output.
- Code coverage reports will be generated (using Vitest's coverage capabilities) and potentially uploaded as artifacts or integrated with services like Codecov.
- Playwright reports (HTML, traces) will be generated for E2E test runs, especially for failures, to aid debugging.
