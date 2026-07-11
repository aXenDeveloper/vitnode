import type { UserConfig } from "tsdown";

const isNodeModule = (id: string): boolean =>
  id.includes("/node_modules/") ||
  (!id.startsWith(".") && !id.startsWith("/") && !id.startsWith("@/"));

export const createTsdownConfig = (overrides: UserConfig = {}): UserConfig => ({
  entry: ["src/**/*.{ts,tsx}", "!**/*.test.{ts,tsx}", "!src/tests/**"],
  outDir: "dist/src",
  format: ["esm"],
  platform: "neutral",
  target: "esnext",
  unbundle: true,
  dts: true,
  minify: true,
  clean: false,
  deps: {
    neverBundle: isNodeModule,
    dts: { neverBundle: isNodeModule },
  },
  ...overrides,
});
