# Code structure

VitNode is a monorepo with `turborepo` and `pnpm` as package manager. The code is organized into two main directories: `apps/` and `packages/`.

## Apps

- `apps/web/` - the main frontend application,
- `apps/docs/` - the documentation application

## Packages

- `packages/eslint/` - custom ESLint configuration with Typescript,
- `packages/vitnode/` - shared components for `web/` project to create frontend & backend
