import { describe, expect, it } from "vitest";

import type { PluginConfigRegistration } from "./add-plugin-to-config.js";

import {
  appsFromRegistrations,
  devCommandFor,
  devServerTargets,
  isRegistered,
  packageRootOf,
} from "./restart-dev-servers.js";

const ROOT = "/repo";

const PACKAGE_DIRS = new Set(["/repo", "/repo/apps/api", "/repo/apps/web"]);

const lookups = {
  hasPackageJson: (dir: string) => PACKAGE_DIRS.has(dir),
  rootPath: ROOT,
  viteConfigIn: (dir: string) =>
    dir === "/repo/apps/web" ? "/repo/apps/web/vite.config.ts" : null,
};

const registration = (
  file: string,
  status: PluginConfigRegistration["status"] = "registered",
): PluginConfigRegistration => ({ file, status });

describe("devCommandFor", () => {
  it.each([
    ["pnpm", "pnpm dev"],
    ["bun", "bun dev"],
    ["npm", "npm run dev"],
    ["pnpm@11.9.0", "pnpm dev"],
  ])("spells the dev command for %s", (packageManager, expected) => {
    expect(devCommandFor(packageManager)).toBe(expected);
  });
});

describe("isRegistered", () => {
  it.each(["registered", "already-registered"] as const)(
    "counts %s as a config the plugin is in",
    status => {
      expect(
        isRegistered(registration("/repo/a/vitnode.config.ts", status)),
      ).toBe(true);
    },
  );

  it.each(["no-config-call", "no-plugins-array"] as const)(
    "skips %s, which nobody edited",
    status => {
      expect(
        isRegistered(registration("/repo/a/vitnode.config.ts", status)),
      ).toBe(false);
    },
  );
});

describe("packageRootOf", () => {
  it("walks up to the package that owns the config", () => {
    expect(
      packageRootOf(
        "/repo/apps/web/src/vitnode.config.ts",
        ROOT,
        lookups.hasPackageJson,
      ),
    ).toBe("/repo/apps/web");
  });

  it("stops at the repository root rather than climbing out of it", () => {
    expect(
      packageRootOf("/repo/loose/vitnode.config.ts", ROOT, () => false),
    ).toBeNull();
  });

  it("accepts a config at the root of a single-package repository", () => {
    expect(
      packageRootOf(
        "/repo/src/vitnode.config.ts",
        ROOT,
        lookups.hasPackageJson,
      ),
    ).toBe("/repo");
  });
});

describe("appsFromRegistrations", () => {
  it("groups both configs of one app into a single restart", () => {
    expect(
      appsFromRegistrations(
        [
          registration("/repo/apps/web/src/vitnode.config.ts"),
          registration("/repo/apps/web/src/vitnode.api.config.ts"),
        ],
        lookups,
      ),
    ).toEqual([
      {
        configFiles: [
          "/repo/apps/web/src/vitnode.config.ts",
          "/repo/apps/web/src/vitnode.api.config.ts",
        ],
        dir: "/repo/apps/web",
        viteConfig: "/repo/apps/web/vite.config.ts",
      },
    ]);
  });

  it("keeps a split deployment's two apps apart", () => {
    expect(
      appsFromRegistrations(
        [
          registration("/repo/apps/api/src/vitnode.api.config.ts"),
          registration("/repo/apps/web/src/vitnode.config.ts"),
        ],
        lookups,
      ).map(app => [app.dir, app.viteConfig]),
    ).toEqual([
      ["/repo/apps/api", null],
      ["/repo/apps/web", "/repo/apps/web/vite.config.ts"],
    ]);
  });

  it("leaves out a config nothing was written to", () => {
    expect(
      appsFromRegistrations(
        [
          registration(
            "/repo/apps/web/src/vitnode.config.ts",
            "no-plugins-array",
          ),
          registration("/repo/apps/api/src/vitnode.api.config.ts"),
        ],
        lookups,
      ).map(app => app.dir),
    ).toEqual(["/repo/apps/api"]);
  });

  it("drops a config with no package around it", () => {
    expect(
      appsFromRegistrations([registration("/repo/loose/vitnode.config.ts")], {
        ...lookups,
        hasPackageJson: () => false,
      }),
    ).toEqual([]);
  });
});

describe("devServerTargets", () => {
  it("restarts a Vite app through its own config, not the VitNode ones", () => {
    expect(
      devServerTargets([
        {
          configFiles: [
            "/repo/apps/web/src/vitnode.config.ts",
            "/repo/apps/web/src/vitnode.api.config.ts",
          ],
          dir: "/repo/apps/web",
          viteConfig: "/repo/apps/web/vite.config.ts",
        },
      ]),
    ).toEqual([
      {
        dir: "/repo/apps/web",
        files: ["/repo/apps/web/vite.config.ts"],
        kind: "vite",
      },
    ]);
  });

  it("restarts a Node API through the configs it watches", () => {
    expect(
      devServerTargets([
        {
          configFiles: ["/repo/apps/api/src/vitnode.api.config.ts"],
          dir: "/repo/apps/api",
          viteConfig: null,
        },
      ]),
    ).toEqual([
      {
        dir: "/repo/apps/api",
        files: ["/repo/apps/api/src/vitnode.api.config.ts"],
        kind: "node",
      },
    ]);
  });

  it("touches each file once, in a stable order", () => {
    const [target] = devServerTargets([
      {
        configFiles: [
          "/repo/apps/api/src/vitnode.api.config.ts",
          "/repo/apps/api/src/vitnode.api.config.ts",
          "/repo/apps/api/src/vitnode.config.ts",
        ],
        dir: "/repo/apps/api",
        viteConfig: null,
      },
    ]);

    expect(target.files).toEqual([
      "/repo/apps/api/src/vitnode.api.config.ts",
      "/repo/apps/api/src/vitnode.config.ts",
    ]);
  });

  it("orders the apps by directory, whichever order they arrived in", () => {
    const apps = [
      {
        configFiles: ["/repo/apps/web/x.ts"],
        dir: "/repo/apps/web",
        viteConfig: null,
      },
      {
        configFiles: ["/repo/apps/api/x.ts"],
        dir: "/repo/apps/api",
        viteConfig: null,
      },
    ];

    expect(devServerTargets(apps).map(target => target.dir)).toEqual([
      "/repo/apps/api",
      "/repo/apps/web",
    ]);
    expect(devServerTargets(apps)).toEqual(
      devServerTargets([...apps].reverse()),
    );
  });

  it("has nothing to restart when nothing was registered", () => {
    expect(devServerTargets([])).toEqual([]);
  });
});
