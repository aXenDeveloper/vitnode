import eslintVitNode from "@vitnode/config/eslint";
import eslintVitNodeReact from "@vitnode/config/eslint.react";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default [
  ...eslintVitNode,
  ...eslintVitNodeReact,
  {
    /**
     * The Next.js specimen the boundary scanners are pointed at.
     *
     * `test-fixtures/next-specimen/` is a deliberate Next.js import graph that
     * exists so the "reaches nothing from `next/*`" assertions have a control -
     * without it they would all pass vacuously. It is kept outside `src` and
     * outside `tsconfig.json`'s `include` on purpose, so `next` never has to be
     * installed for tsc to accept the package.
     *
     * That is exactly why ESLint has to skip it: the typed rules need a file to
     * be in the project and this one deliberately is not, and the `next` import
     * ban in `@vitnode/config/eslint.react` would flag the specimen for
     * containing the very thing it is a specimen of.
     */
    ignores: ["test-fixtures/**"],
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
