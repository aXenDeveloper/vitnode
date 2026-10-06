// @vitest-environment node
import type { InlineConfig, Plugin } from "vite";

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ViteBuildApi } from "../builder/app-build";

import { snapshotPathFor } from "../builder/snapshot";
import { RuntimeError } from "../errors";
import { createTestContext } from "../testing";
import { captureProcessOutput } from "../ui/capture-output";
import { runBuildCommand } from "./build";

interface FakeChunk {
  code: string;
  facadeModuleId?: null | string;
  fileName: string;
  modules?: Record<string, { renderedLength: number }>;
  name: string;
}

interface FakeEnvironment {
  chunks: FakeChunk[];
  consumer: "client" | "server";
  name: string;
  outDir: string;
}

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "vitnode-build-"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "web" }));
  writeFileSync(join(root, "vite.config.ts"), "export default {};\n");
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

type Hook = (this: unknown, ...args: unknown[]) => unknown;

const call = (
  plugin: Plugin,
  hook: keyof Plugin,
  context: unknown,
  ...args: unknown[]
) => {
  const handler = plugin[hook] as Hook | undefined;

  return handler?.call(context, ...args);
};

/**
 * A stand-in for Vite: runs the plugin hooks the real builder would, in the
 * same order, and writes the files it claims to have written - so the build
 * report reads real files off disk.
 */
const fakeVite = (
  environments: FakeEnvironment[],
  { fail }: { fail?: Error } = {},
): ViteBuildApi & { configs: InlineConfig[] } => {
  const configs: InlineConfig[] = [];

  return {
    configs,
    createBuilder: async config => {
      await Promise.resolve();
      configs.push(config);
      const plugins = (config.plugins ?? []) as Plugin[];

      return {
        buildApp: async () => {
          for (const environment of environments) {
            const context = {
              environment: {
                config: { consumer: environment.consumer },
                name: environment.name,
              },
            };
            for (const plugin of plugins)
              await call(plugin, "buildStart", context);

            if (fail !== undefined && environment.consumer === "server") {
              process.stdout.write("plugin noise before the failure\n");
              for (const plugin of plugins)
                await call(plugin, "buildEnd", context, fail);
              throw fail;
            }

            const dir = join(root, environment.outDir);
            const bundle = Object.fromEntries(
              environment.chunks.map(chunk => {
                const path = join(dir, chunk.fileName);
                mkdirSync(dirname(path), { recursive: true });
                writeFileSync(path, chunk.code);

                return [
                  chunk.fileName,
                  {
                    facadeModuleId: chunk.facadeModuleId ?? null,
                    fileName: chunk.fileName,
                    isEntry: chunk.facadeModuleId != null,
                    modules: chunk.modules ?? {},
                    name: chunk.name,
                    type: "chunk",
                  },
                ];
              }),
            );
            for (const plugin of plugins)
              await call(plugin, "writeBundle", context, { dir }, bundle);
            for (const plugin of plugins)
              await call(plugin, "closeBundle", context);
          }
        },
        config: { plugins: [{ name: "vitnode:plugin-routes" }] },
      };
    },
  };
};

const noise = (bytes: number, seed: string) => {
  let text = "";
  let state = seed.length;
  while (text.length < bytes) {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    text += state.toString(36);
  }

  return text.slice(0, bytes);
};

const appBuild = (
  sizes: { admin: number; index: number },
  hash = "AAAAAAA1",
): FakeEnvironment[] => [
  {
    chunks: [
      {
        code: noise(sizes.index, "index"),
        facadeModuleId: join(root, "src", "main.tsx"),
        fileName: `assets/index-${hash}.js`,
        modules: {
          [join(root, "src", "main.tsx")]: { renderedLength: 400 },
          [join(root, "node_modules", "react-dom", "index.js")]: {
            renderedLength: 600,
          },
        },
        name: "index",
      },
      {
        code: noise(sizes.admin, "admin"),
        facadeModuleId: join(root, "src", "admin.tsx"),
        fileName: `assets/admin-${hash}.js`,
        modules: {
          [join(root, "node_modules", "@tiptap", "core", "index.js")]: {
            renderedLength: 900,
          },
          [join(root, "src", "admin.tsx")]: { renderedLength: 100 },
        },
        name: "admin",
      },
    ],
    consumer: "client",
    name: "client",
    outDir: ".output/public",
  },
  {
    chunks: [{ code: "intermediate", fileName: "index.js", name: "index" }],
    consumer: "server",
    name: "ssr",
    outDir: "node_modules/.nitro/ssr",
  },
  {
    chunks: [
      {
        code: noise(2000, "server"),
        facadeModuleId: "/x/server.mjs",
        fileName: "index.mjs",
        name: "index",
      },
    ],
    consumer: "server",
    name: "nitro",
    outDir: ".output/server",
  },
];

const passThrough = () => ({ restore: () => "" });

const build = async (
  vite: ViteBuildApi,
  options: {
    analyze?: boolean;
    captureOutput?: () => { restore: () => string };
    env?: Record<string, string>;
    interactive?: boolean;
    plain?: boolean;
    verbose?: boolean;
  } = {},
) => {
  const { context, runtime } = createTestContext({ cwd: root, ...options });
  const code = await runBuildCommand(context, options, {
    appBuild: {
      captureOutput: options.captureOutput ?? passThrough,
      loadVite: async () => await Promise.resolve(vite),
    },
    now: () => 0,
  });

  return { code, runtime };
};

describe("vitnode build for an app", () => {
  it("builds through Vite and reports each real environment", async () => {
    const vite = fakeVite(appBuild({ admin: 612_400, index: 82_400 }));
    const { code, runtime } = await build(vite);
    const output = runtime.output();

    expect(code).toBe(0);
    expect(output).toContain("✓ Configuration loaded, plugin routes generated");
    expect(output).toContain("✓ Building client");
    expect(output).toContain("✓ Building server");
    expect(output).toContain("✓ Packaging server (Nitro)");
    expect(output).toContain("✓ Built in 0ms");
    expect(vite.configs[0]).toMatchObject({ mode: "production", root });
  });

  it("lists the output with sizes, gzip and severity, grouped by kind", async () => {
    const { runtime } = await build(
      fakeVite(appBuild({ admin: 612_400, index: 82_400 })),
    );
    const output = runtime.output();

    expect(output).toMatch(/Client JS {2}\.output\/public/);
    expect(output).toMatch(
      /▲ assets\/admin-AAAAAAA1\.js\s+612\.4 kB\s+\d+\.\d kB/,
    );
    expect(output).toMatch(/✓ assets\/index-AAAAAAA1\.js\s+82\.4 kB/);
    expect(output).toMatch(/Server {2}\.output\/server/);
    expect(output).toContain("index.mjs");
  });

  it("leaves out intermediate output another environment consumes", async () => {
    const { runtime } = await build(
      fakeVite(appBuild({ admin: 1000, index: 1000 })),
    );

    expect(runtime.output()).not.toContain("node_modules/.nitro");
  });

  it("warns about an oversized client chunk with actionable advice, and still succeeds", async () => {
    const { code, runtime } = await build(
      fakeVite(appBuild({ admin: 612_400, index: 1000 })),
    );
    const output = runtime.output();

    expect(code).toBe(0);
    expect(output).toContain(
      "▲ admin-AAAAAAA1.js is larger than the recommended 500.0 kB for a client chunk.",
    );
    expect(output).toContain("dynamic import()");
    expect(output).toContain("never fail a build");
  });

  it("does not warn about a large server bundle", async () => {
    const environments = appBuild({ admin: 1000, index: 1000 });
    environments[2].chunks[0].code = noise(5_000_000, "big-server");
    const { runtime } = await build(fakeVite(environments));

    expect(runtime.output()).not.toContain("Warnings");
  });

  it("prints stable [OK] lines without color in plain mode", async () => {
    const { runtime } = await build(
      fakeVite(appBuild({ admin: 612_400, index: 1000 })),
      {
        interactive: true,
        plain: true,
      },
    );

    expect(runtime.output()).toContain("[OK] Building client");
    expect(runtime.output()).toContain("[WARN] admin-AAAAAAA1.js is larger");
    expect(runtime.raw()).not.toContain("\x1b[");
    expect(runtime.raw()).not.toContain("\r");
  });

  it("never animates in CI, even on a TTY", async () => {
    const { runtime } = await build(
      fakeVite(appBuild({ admin: 1000, index: 1000 })),
      {
        env: { CI: "true" },
        interactive: true,
      },
    );

    expect(runtime.raw()).not.toContain("\r");
  });

  it("passes the bundler's own log level through in verbose mode", async () => {
    const vite = fakeVite(appBuild({ admin: 1000, index: 1000 }));
    await build(vite, { verbose: true });

    expect(vite.configs[0]).toMatchObject({ logLevel: "info" });
    expect(vite.configs[0].customLogger).toBeUndefined();
  });
});

describe("comparison with the previous build", () => {
  it("shows nothing to compare on the first build, then the change on the next", async () => {
    const first = await build(
      fakeVite(appBuild({ admin: 342_500, index: 82_400 }, "AAAAAAA1")),
    );
    expect(first.runtime.output()).not.toContain("Bundle changes");
    expect(existsSync(snapshotPathFor(root))).toBe(true);

    const second = await build(
      fakeVite(appBuild({ admin: 428_600, index: 82_400 }, "BBBBBBB2")),
    );
    const output = second.runtime.output();

    expect(output).toContain("Bundle changes");
    expect(output).toMatch(
      /assets\/admin-BBBBBBB2\.js\s+428\.6 kB\s+\+86\.1 kB\s+\+25\.1%\s+▲/,
    );
    expect(output).not.toMatch(/assets\/index-BBBBBBB2\.js\s+82\.4 kB\s+\+/);
  });

  it("survives a corrupted snapshot and replaces it", async () => {
    const path = snapshotPathFor(root);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, "{ corrupted");

    const { code, runtime } = await build(
      fakeVite(appBuild({ admin: 1000, index: 1000 })),
    );

    expect(code).toBe(0);
    expect(runtime.output()).toContain("size snapshot was unreadable");
    expect(
      (
        await build(fakeVite(appBuild({ admin: 1000, index: 1000 })))
      ).runtime.output(),
    ).toContain("No size changes since the previous build.");
  });
});

describe("vitnode build --analyze", () => {
  it("breaks the largest chunks down by package", async () => {
    const { runtime } = await build(
      fakeVite(appBuild({ admin: 612_400, index: 1000 })),
      {
        analyze: true,
      },
    );
    const output = runtime.output();

    expect(output).toContain("Bundle analysis");
    expect(output).toMatch(/@tiptap\/core\s+≈ 551\.2 kB\s+90\.0%/);
    expect(output).toMatch(/application code\s+≈ 61\.2 kB\s+10\.0%/);
    expect(output).toContain(
      "@tiptap/core makes up 90.0% of admin-AAAAAAA1.js",
    );
    expect(output).toContain("brotli");
  });

  it("says when analysis is unavailable instead of failing the build", async () => {
    const environments = appBuild({ admin: 1000, index: 1000 });
    environments[0].chunks.forEach(chunk => {
      chunk.modules = {};
    });
    const { code, runtime } = await build(fakeVite(environments), {
      analyze: true,
    });

    expect(code).toBe(0);
    expect(runtime.output()).toContain(
      "Unavailable: the bundler reported no module information",
    );
  });
});

describe("a failed build", () => {
  it("fails with where it happened - including the plugin that owns the file", async () => {
    const plugin = join(root, "plugins", "blog");
    mkdirSync(join(plugin, "src", "routes"), { recursive: true });
    writeFileSync(
      join(plugin, "package.json"),
      JSON.stringify({
        dependencies: { "@vitnode/core": "*" },
        name: "@acme/blog",
      }),
    );
    writeFileSync(join(plugin, "src", "config.tsx"), "");

    const error = Object.assign(new Error("Missing export: title"), {
      frame: "41 | const a = 1;\n42 | export { title } from './x';",
      id: join(plugin, "src", "routes", "post.tsx"),
      loc: {
        column: 9,
        file: join(plugin, "src", "routes", "post.tsx"),
        line: 42,
      },
      plugin: "vite:esbuild",
    });

    const failure = await build(
      fakeVite(appBuild({ admin: 1000, index: 1000 }), { fail: error }),
      {
        captureOutput: captureProcessOutput,
      },
    ).catch((thrown: unknown) => thrown);

    expect(failure).toBeInstanceOf(RuntimeError);
    const { cause, details, message } = failure as RuntimeError;
    expect(message).toBe("Build failed");
    expect(details).toContain("Plugin   @acme/blog");
    expect(details).toContain("File     plugins/blog/src/routes/post.tsx:42:9");
    expect(details).toContain("Step     vite:esbuild");
    expect(details).toContain("Missing export: title");
    expect(cause).toBe(error);
    // What plugins printed is held back during the build, then shown with
    // the error it explains.
    expect((failure as RuntimeError).output).toContain(
      "plugin noise before the failure",
    );
  });

  it("does not invent context for an error that carries none", async () => {
    const failure = (await build(
      fakeVite(appBuild({ admin: 1000, index: 1000 }), {
        fail: new Error("Something odd"),
      }),
    ).catch((thrown: unknown) => thrown)) as RuntimeError;

    expect(failure.details).toEqual(["Something odd"]);
  });
});
