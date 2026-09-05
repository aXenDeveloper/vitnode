import { describe, expect, it } from "vitest";

import { vitnode } from "./vitnode";

const names = (plugins: { name: string }[]) => plugins.map(({ name }) => name);

describe("the composed plugin", () => {
  it("returns all four, in the order they have to run", () => {
    expect(names(vitnode({ appRoot: "/app" }))).toEqual([
      "vitnode:env",
      "vitnode:optimize-deps",
      "vitnode:ssr-externals",
      "vitnode:plugin-routes",
    ]);
  });

  it("needs nothing but the app root", () => {
    expect(() => vitnode({ appRoot: "/app" })).not.toThrow();
  });

  it("passes clientEnv through to the environment plugin", () => {
    const [env] = vitnode({
      appRoot: "/app",
      clientEnv: ["NEXT_PUBLIC_MAP_KEY"],
    });
    const defined = Object.keys(
      // `config` is the hook the plugin does its work in; calling it directly is
      // what Vite does, and it is the only way to see what was inlined.
      (
        (env as { config: (config: object, env: object) => object }).config(
          { root: import.meta.dirname },
          { mode: "development" },
        ) as {
          environments: { client: { define: Record<string, string> } };
        }
      ).environments.client.define,
    );

    expect(defined).toContain("process.env.NEXT_PUBLIC_MAP_KEY");
    // The two every VitNode install publishes are still there - `clientEnv`
    // adds to that list rather than replacing it.
    expect(defined).toContain("process.env.NEXT_PUBLIC_API_URL");
    expect(defined).toContain("process.env.NEXT_PUBLIC_WEB_URL");
  });

  it("keeps the dev-server-only plugin dev-server-only", () => {
    const [, optimizeDeps] = vitnode({ appRoot: "/app" });

    expect((optimizeDeps as { apply?: string }).apply).toBe("serve");
  });
});
