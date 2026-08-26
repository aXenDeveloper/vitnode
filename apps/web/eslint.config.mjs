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
      ".source",
      ".nitro/**",
      ".output/**",
      ".tanstack/**",
      "dist/**",
      "src/routeTree.gen.ts",
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
];
