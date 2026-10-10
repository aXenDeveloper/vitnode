---
name: vitnode-upgrade-npm-packages
description: A skill that helps users upgrade their npm packages to the latest versions.
---

# Upgrade NPM Packages Skill

## Instructions

[Clear, step-by-step guidance for Claude to follow]

1. Open `packages/create-vitnode-app/src/create/package-versions.ts` file and read it.
2. Run `pnpm outdated` to check for outdated packages in the project - do it for all projects in the turborepo (monorepo) including with root.
3. Check pre-release dependencies separately - `pnpm outdated` compares against the `latest` dist-tag only, so it never reports a newer rc/beta/alpha/canary (e.g. `drizzle-orm@1.0.0-rc.4`, `drizzle-kit`, `nitro@3.0.x-beta`).
   - List them across every workspace `package.json` (root, `apps/*`, `packages/*`, `plugins/*`), including `npm:` aliases, plus the `nitro`/`drizzle*` entries in `package-versions.ts`:

     ```bash
     for f in package.json apps/*/package.json packages/*/package.json plugins/*/package.json; do
       jq -r --arg f "$f" '[.dependencies,.devDependencies,.peerDependencies,.optionalDependencies] | map(select(.)) | add // {} | to_entries[] | select(.value|test("-[a-z]")) | select(.value|test("workspace")|not) | "\(.key) \(.value) \($f)"' "$f"
     done
     ```

   - For each, run `npm view <package-name> dist-tags --json` and `npm view <package-name> versions --json`. Upgrade to the newest version on the same channel (the `rc`/`beta`/`latest` tag the current version belongs to, or a newer clean release such as `1.0.0-rc.5` / `1.0.0`). Ignore commit-hash snapshot builds like `1.0.0-rc.5-5935859` and feature-branch tags.
   - Keep the pin style the file already uses (exact `1.0.0-rc.4` vs `^1.0.0-rc.4`) and bump every workspace that uses the package to the same version.
   - A channel jump (rc → stable, beta → rc) counts as a possible breaking change - read the release notes and ask the user (step 5).
4. For each outdated package, run `pnpm up -r <package-name>@<version>` to upgrade it.
5. For each package, check if there are any breaking changes in the new version. If there are, ask the user if they want to proceed with the upgrade or skip it.
6. After upgrading all packages, update the `package-versions.ts` file with the new versions of the packages, including pre-release pins (`drizzleKit`, `drizzleOrm`, `nitro`).
7. Run `pnpm install` to ensure all dependencies are correctly installed.

## Examples

I'm working on a project that uses a monorepo structure with multiple packages. I want to ensure that all my npm packages are up-to-date. I will use the "upgrade-npm-packages" skill to check for outdated packages, upgrade them, and handle any breaking changes appropriately.
