# VitNode AI Coding Agent Guidelines (Extended)

The repository is a monorepo for the VitNode framework, which includes a backend API, frontend documentation site, and shared packages.

## Main Rules

- Use React 19.2, Next.js 16, TypeScript 5.9, Hono.js 4,
- Use pnpm as the runtime environment,
- Use Tailwind CSS 4 for styling,

## API

- Please use as much as possible server-side API calls (server components, server actions),
- For client API calls, use `tanstack/react-query` hooks,

## TypeScript

- Avoid using `any` type,
- Do not nest ternary operators,
- Avoid creating `index.ts` files for exports, instead use explicit file names,
- Use only `const` for create functions, but `function` for pages and generic functions,
- Prefer using nullish coalescing operator (`??`) instead of a logical or (`||`), as it is a safer operator,

## React

- Don't use `React.FC`, instead explicitly type props
- Don't use `useMemo` and `useCallback`. Project has React Compiler

## Animations

- Use `motion/react` for animations and gestures,
- Use `translate` instead of `top`/`left` for moving elements, as it is more performant
