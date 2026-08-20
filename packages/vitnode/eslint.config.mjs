import eslintVitNode from "@vitnode/config/eslint";
import eslintVitNodeReact from "@vitnode/config/eslint.react";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default [
  ...eslintVitNode,
  ...eslintVitNodeReact,
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
      },
    },
  },
  {
    // Navigation goes through `@/framework/navigation`, whose whole purpose is to
    // be the one module that knows which framework is underneath. Two areas are
    // exempt because they *are* the framework layer: the adapter itself, and
    // `src/routes/**`, which is App Router `page.tsx`/`layout.tsx` files copied
    // verbatim into the apps - a port rewrites those files rather than reusing
    // them, so a raw `next/*` import there costs nothing.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/framework/**", "src/routes/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          name: "next/link",
          message: "Please import from `@/framework/navigation` instead.",
        },
        {
          name: "next/navigation",
          importNames: [
            "notFound",
            "permanentRedirect",
            "redirect",
            "usePathname",
            "useRouter",
            "useSearchParams",
          ],
          message: "Please import from `@/framework/navigation` instead.",
        },
        {
          name: "next/router",
          importNames: ["useRouter"],
          message:
            "This import is from Page router. Please import from `@/framework/navigation` instead.",
        },
        {
          name: "drizzle-orm/mysql-core",
          message: "Please import from `drizzle-orm/pg-core` instead.",
        },
      ],
    },
  },
];
