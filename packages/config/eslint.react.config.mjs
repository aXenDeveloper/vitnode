// @ts-check

import eslintReact from "@eslint-react/eslint-plugin";
import hooksPlugin from "eslint-plugin-react-hooks";
import reactYouMightNotNeedAnEffect from "eslint-plugin-react-you-might-not-need-an-effect";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default [
  reactYouMightNotNeedAnEffect.configs.recommended,
  eslintReact.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"],
    settings: {
      react: {
        version: "detect",
      },
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
  {
    plugins: {
      "react-hooks": hooksPlugin,
      "jsx-a11y": jsxA11y,
    },
    rules: {
      "react/react-in-jsx-scope": "off",
      ...hooksPlugin.configs.recommended.rules,
    },
  },
  { files: ["**/*.{js,mjs,cjs,jsx,mjsx,ts,tsx,mtsx}"] },
  {
    rules: {
      "@eslint-react/no-leaked-conditional-rendering": "error",
      "react-hooks/exhaustive-deps": "off",
      "@eslint-react/no-context-provider": "off",
      "@eslint-react/no-unstable-default-props": "off",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              // VitNode runs on TanStack Start. Next.js is not a dependency of
              // any workspace package, so these resolve to nothing - the ban is
              // here to fail the lint with an explanation rather than a
              // "cannot find module".
              group: ["next", "next/*", "next/**"],
              message:
                "VitNode no longer runs on Next.js. Use `@vitnode/core/tanstack/*` for routing and navigation.",
            },
            {
              // `use-intl` is the framework-neutral half of next-intl and is a
              // direct dependency of @vitnode/core. `next-intl` re-exports it
              // plus Next server bindings that no longer have a runtime.
              group: ["next-intl", "next-intl/*"],
              message: "Import from `use-intl` instead of `next-intl`.",
            },
          ],
        },
      ],
    },
  },
];
