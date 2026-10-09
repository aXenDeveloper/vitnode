import { defineConfig } from "oxfmt";

export default defineConfig({
  singleQuote: false,
  arrowParens: "avoid",
  trailingComma: "all",
  printWidth: 80,
  sortPackageJson: false,
  sortTailwindcss: {
    functions: ["cn"],
  },
});
