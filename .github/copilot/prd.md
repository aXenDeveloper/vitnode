# VitNode - Extendable Framework for Building Applications with Next.js and Hono.js

## Project Overview

VitNode is a comprehensive framework designed to simplify and accelerate application development with Next.js and Hono.js. Built as a monorepo solution managed by Turborepo, VitNode provides a structured environment that makes development faster and less complex. The framework includes an integrated AdminCP and plugin system to extend its core functionality.

## Main Problem

Building applications with Next.js and Hono.js can be complex and time-consuming. Developers often face challenges in managing application structure, handling routing, and integrating various components seamlessly. Additionally, the lack of a unified framework leads to inconsistencies and difficulties in maintaining the codebase.

Key problems VitNode solves:

- Complexity in managing application structure
- Time-consuming creation of basic functionalities
- Lack of a consistent plugin system for extending functionality
- Difficulties in managing authorization and authentication
- Complicated configuration and integration of various components

## Target Users

VitNode is designed for individual developers and small teams who need a structured, extensible framework for building applications. Users are expected to have a basic understanding of JavaScript (with TypeScript) and Next.js, but don't need extensive expertise in complex framework architectures.

## Core Features

### Structure and Configuration

- Monorepo structure using Turborepo with `apps` and `plugins` directories
- Simple CLI tool for creating new projects (`create-vitnode-app`)
- Script to set up PostgreSQL database with initial data (roles, languages, etc.)
- Internationalization (i18n) support using next-intl (RTL not required for MVP)
- Dark/Light mode support

### Plugin System

- Monorepo-based plugin architecture created using `npx create-vitnode-plugin`
- Plugins can extend functionality by creating:
  - New pages and routes
  - API endpoints
  - AdminCP pages
  - SSO providers
  - Email providers (SMTP, Resend)

### CI/CD

- Automated workflows using GitHub Actions:
  - Code quality checks (linting, formatting)
  - Test suite execution on pull requests and main branch
  - Dependency security scanning
  - Automated builds and deployments to staging/production environments
  - Version tagging and changelog generation
  - Docker image building and publishing
  - Database schema validation and migration checks

### Authentication & Authorization

- Authentication via credentials and SSO (Facebook, Google, GitHub)
- User registration and login functionality
- Password reset and email verification
- Session management in cookies and database:
  - 3 months for users
  - 24 hours for admins
  - No session storage for guests
- Security features including password hashing, secure cookies, and protection against CSRF and XSS

### Role Management

- AdminCP interface for role CRUD operations
- Role assignment to users
- Role-based permission system with capabilities defined in the database
- Permissions enforced through middleware in API and AdminCP

### User Management

- AdminCP interface for user CRUD operations
- Search and filter functionality for users
- User profile editing (password, email, avatar, role assignment)

### API and Documentation

- OpenAPI documentation for all API endpoints
- API versioning support (core functionality handled by framework, plugins can implement multiple versions)
- Comprehensive documentation using Fumadocs
- Documentation structured by feature with examples and best practices

### Developer Tools

- Integration with Next.js and Hono.js debugging tools
- Support for react-scan for component debugging
- Helper functions for form handling, API calls, and routing
- Clear error messages and debugging guidance

## Features Planned for Future Releases

The following features are not included in the MVP but will be available in future iterations:

- File uploads
- WYSIWYG editor
- WebSockets
- Caching
- Rate limiting
- Additional analytics features

## Success Criteria

### Developer Experience

- Developers should be able to easily create and manage applications using the VitNode framework
- Measured by user feedback and time taken to create CRUD operations, forms, and plugins
- Positive user feedback regarding ease of use and framework utility

### Performance

- Complex pages should have a score of 90+ in Lighthouse
- Achieved through code splitting, lazy loading, image optimization, and static page generation with suspense

### Accessibility

- UI should be accessible and follow WCAG 2.1 guidelines
- Components should be properly labeled and compatible with screen readers

### Deployment

- VitNode should deploy applications with minimal configuration to:
  - Vercel (serverless) with Supabase (PostgreSQL)
  - Docker (self-hosted)

### Documentation

- Complete and up-to-date documentation for all framework features
- Positive user feedback on documentation quality and usefulness
- Effective examples and best practices to facilitate framework usage

## Developer Workflow

The ideal developer workflow includes:

1. `npx create-vitnode-app` to create a new project
2. `npm install` to install dependencies
3. `npm run docker:dev` to start database in Docker
4. `npm run dev` to start the development server
5. `npm run build` to build the application for production
6. `npm run start` to start the production server
