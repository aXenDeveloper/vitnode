---
name: upgrade-npm-packages
description: A skill that helps users upgrade their npm packages to the latest versions.
---

# Upgrade NPM Packages Skill

## Instructions

[Clear, step-by-step guidance for Claude to follow]

1. Open `packages/create-vitnode-app/src/create/package-versions.ts` file and read it.
2. Run `pnpm outdated` to check for outdated packages in the project - do it for all projects in the turborepo (monorepo) including with root.
3. For each outdated package, run `pnpm up <package-name>@<version>` to upgrade it.
4. For each package, check if there are any breaking changes in the new version. If there are, ask the user if they want to proceed with the upgrade or skip it.
5. After upgrading all packages, update the `package-versions.ts` file with the new versions of the packages.
6. Run `pnpm install` to ensure all dependencies are correctly installed.

## Examples

I'm working on a project that uses a monorepo structure with multiple packages. I want to ensure that all my npm packages are up-to-date. I will use the "upgrade-npm-packages" skill to check for outdated packages, upgrade them, and handle any breaking changes appropriately.
