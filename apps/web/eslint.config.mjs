import eslintVitNode from "@vitnode/config/eslint";
import eslintVitNodeReact from "@vitnode/config/eslint.react";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default [
  ...eslintVitNode,
  ...eslintVitNodeReact,
  {
    // Build output, not source. `eslint .` walks these otherwise and every file
    // in them fails to parse: they are outside `tsconfig.json`'s `include`.
    ignores: [
      ".source/**",
      ".nitro/**",
      ".output/**",
      ".tanstack/**",
      "dist/**",
      "src/routeTree.gen.ts",
      "src/plugin-routes.gen.ts",
      "src/plugin-route-manifest.gen.ts",
      "src/admin-nav.gen.ts",
      "src/content-registry.gen.ts",
      "scripts/**",
      "prettier.config.js",
    ],
  },
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
      },
    },
  },
  {
    /*
     * `src/tests` runs on Node's own test runner, whose `describe` and `it`
     * return promises the runner itself awaits.
     *
     * `void`-ing every one of them would be noise, and awaiting them is wrong -
     * the suite would then be sequenced by hand. `allowForKnownSafeCalls` is
     * typescript-eslint's own answer for exactly this, and it names the three
     * functions from `node:test` rather than exempting the directory, so a
     * genuinely floating promise in a test still fails the lint.
     */
    files: ["src/tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-floating-promises": [
        "error",
        {
          allowForKnownSafeCalls: [
            {
              from: "package",
              name: ["describe", "it", "test"],
              package: "node:test",
            },
          ],
        },
      ],
    },
  },
];
