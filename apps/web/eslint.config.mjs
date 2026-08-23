import eslintVitNode from "@vitnode/config/eslint";
import eslintVitNodeReact from "@vitnode/config/eslint.react";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default [
  ...eslintVitNode,
  ...eslintVitNodeReact,
  {
    ignores: ["src/routeTree.gen.ts", ".output", ".nitro", ".tanstack"],
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
