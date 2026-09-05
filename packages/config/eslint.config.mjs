// @ts-check

import eslint from "@eslint/js";
import perfectionist from "eslint-plugin-perfectionist";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import tsEslint from "typescript-eslint";

export default [
  {
    ignores: [
      "dist",
      ".prettierrc.mjs",
      "node_modules",
      "eslint.config.mjs",
      "postcss.config.mjs",
      ".turbo",
      "global.d.ts",
      "tsup.config.ts",
      "*.test.tsx",
      "drizzle.config.ts",
      "cli.mjs",
    ],
  },
  eslint.configs.recommended,
  ...tsEslint.configs.stylisticTypeChecked,
  ...tsEslint.configs.strictTypeChecked,
  eslintPluginPrettierRecommended,
  perfectionist.configs["recommended-natural"],
  { files: ["**/*.{js,mjs,cjs,jsx,mjsx,ts,tsx,mtsx}"] },
  {
    rules: {
      "perfectionist/sort-array-includes": "warn",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/no-unnecessary-type-parameters": "off",
      "@typescript-eslint/no-misused-spread": "off",
      "perfectionist/sort-decorators": "warn",
      "perfectionist/sort-modules": "off",
      "perfectionist/sort-switch-case": "warn",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "perfectionist/sort-named-exports": "warn",
      "perfectionist/sort-enums": "warn",
      "perfectionist/sort-exports": "warn",
      "@typescript-eslint/no-dynamic-delete": "off",
      "perfectionist/sort-named-imports": "warn",
      "perfectionist/sort-intersection-types": "warn",
      "perfectionist/sort-interfaces": "warn",
      "perfectionist/sort-union-types": "warn",
      "perfectionist/sort-object-types": "warn",
      "perfectionist/sort-jsx-props": "warn",
      "perfectionist/sort-imports": "warn",
      "@typescript-eslint/no-unsafe-call": "off",
      "perfectionist/sort-objects": "off",
      "perfectionist/sort-classes": [
        "warn",
        {
          groups: [
            "constructor",
            "static-block",
            "index-signature",
            "static-property",
            ["protected-property", "protected-accessor-property"],
            ["private-property", "private-accessor-property"],
            ["property", "accessor-property"],
            "static-method",
            "protected-method",
            "private-method",
            "method",
            ["get-method", "set-method"],
            "unknown",
          ],
        },
      ],
      "no-console": "error",
      "consistent-return": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          ignoreRestSiblings: false,
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-useless-constructor": "off",
      "@typescript-eslint/prefer-readonly": "warn",
      "@typescript-eslint/require-array-sort-compare": "error",
      "@typescript-eslint/promise-function-async": "error",
      "@typescript-eslint/no-extraneous-class": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/consistent-type-exports": "error",
      "@typescript-eslint/no-unnecessary-qualifier": "error",
      "@typescript-eslint/no-useless-empty-export": "error",
      "@typescript-eslint/method-signature-style": "warn",
      "newline-before-return": "warn",
      "no-restricted-imports": [
        "error",
        {
          name: "drizzle-orm/mysql-core",
          message: "Please import from `drizzle-orm/pg-core` instead.",
        },
      ],
    },
  },
  {
    // A plugin's route tree - and only that file - is one
    // `lazy(() => import("./pages/my-page"))` per route, which is VitNode's
    // documented API: the callback is *stored*, never called here, so
    // `promise-function-async` would ask every plugin author to write
    // `async () => await import(...)` for a promise nobody in the file awaits.
    //
    // `**/src/routes.ts` rather than `**/routes.ts`, because the parent
    // directory is what makes it a route tree: a plugin's is `src/routes.ts`,
    // which is what its `<plugin>/routes` export subpath resolves to. Any other
    // `routes.ts` - `src/content/server/routes.ts`, an API module's - keeps the
    // rule, and should.
    files: ["**/src/routes.ts", "**/src/routes.tsx"],
    rules: { "@typescript-eslint/promise-function-async": "off" },
  },
];
