// @vitest-environment node
import type { ViteDevServer } from "vite";

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DatabaseServices } from "../db/database";
import type { RunProcessOptions } from "../project/processes";

import { formatRequest, shouldLogRequest } from "../dev/request-log";
import { createDevReporter } from "../dev/vite-dev";
import { RuntimeError } from "../errors";
import { createTestContext } from "../testing";
import { createUi } from "../ui/ui";
import { runDevCommand } from "./dev";

const packageRoot = join(import.meta.dirname, "..", "..", "..");
let root: string;

beforeEach(() => {
  // Inside the package, so compiler binaries resolve from its node_modules.
  const cache = join(packageRoot, "node_modules", ".cache");
  mkdirSync(cache, { recursive: true });
  root = mkdtempSync(join(cache, "vitnode-dev-"));
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

const write = (path: string, content = "") => {
  mkdirSync(join(root, path, ".."), { recursive: true });
  writeFileSync(join(root, path), content);
};

/** A process group that records what it was asked to run. */
const fakeGroup = (exit?: Promise<number>) => {
  const spawned: RunProcessOptions[] = [];

  return {
    firstExit: vi.fn(async () => exit ?? new Promise<number>(() => undefined)),
    spawn: vi.fn((options: RunProcessOptions) => {
      spawned.push(options);

      return {} as never;
    }),
    spawned,
    stop: vi.fn(async () => await Promise.resolve(undefined)),
  };
};

const fakeServer = ({ listenError }: { listenError?: Error } = {}) => {
  const server = {
    bindCLIShortcuts: vi.fn(),
    close: vi.fn(async () => await Promise.resolve(undefined)),
    config: { server: { port: 3000 } },
    listen: vi.fn(async () => {
      await Promise.resolve();
      if (listenError) throw listenError;

      return server;
    }),
    resolvedUrls: {
      local: ["http://localhost:3000/"],
      network: [] as string[],
    },
  };

  return server;
};

const tick = async () => new Promise(resolve => setTimeout(resolve, 10));

/** Resolves once `check` passes, failing the test if it never does. */
const until = async (check: () => boolean) => {
  for (let i = 0; i < 200; i += 1) {
    if (check()) return;
    await tick();
  }
  throw new Error("condition never became true");
};

describe("vitnode dev in a plugin package", () => {
  beforeEach(() => {
    write("package.json", JSON.stringify({ name: "@acme/blog" }));
    write("tsconfig.build.json", "{}");
    write(".swcrc", "{}");
  });

  it("runs the three compilers in watch mode and stops them on Ctrl+C", async () => {
    const group = fakeGroup();
    const { context, runtime } = createTestContext({ cwd: root });

    const running = runDevCommand(context, {}, { group });
    await until(() => group.spawn.mock.calls.length === 3);
    runtime.signals.emit("SIGINT");

    expect(await running).toBe(0);
    expect(group.stop).toHaveBeenCalledOnce();
    expect(
      group.spawned.map(options => options.args.slice(1).join(" ")),
    ).toEqual([
      "-w -p tsconfig.build.json --preserveWatchOutput",
      "src -d dist --config-file .swcrc --copy-files -w",
      "-w -p tsconfig.build.json",
    ]);
    // Run by Node itself, never through a shell.
    expect(
      group.spawned.every(options => options.command === process.execPath),
    ).toBe(true);
  });

  it("stops every watcher and fails when one of them crashes", async () => {
    const group = fakeGroup(Promise.resolve(2));
    const { context } = createTestContext({ cwd: root });

    await expect(runDevCommand(context, {}, { group })).rejects.toThrow(
      "A watcher exited with code 2.",
    );
    expect(group.stop).toHaveBeenCalledOnce();
  });

  it("also stops on SIGTERM, as a container or process manager sends it", async () => {
    const group = fakeGroup();
    const { context, runtime } = createTestContext({ cwd: root });

    const running = runDevCommand(context, {}, { group });
    await until(() => group.spawn.mock.calls.length === 3);
    runtime.signals.emit("SIGTERM");

    expect(await running).toBe(0);
  });
});

describe("vitnode dev in an app", () => {
  beforeEach(() => {
    write("package.json", JSON.stringify({ name: "web" }));
    write("vite.config.ts", "export default {};");
  });

  const start = async ({
    database,
    interactive = false,
    server = fakeServer(),
  }: {
    database?: DatabaseServices;
    interactive?: boolean;
    server?: ReturnType<typeof fakeServer>;
  } = {}) => {
    await Promise.resolve();
    const { context, runtime } = createTestContext({ cwd: root, interactive });
    const createServer = vi.fn(
      async () => await Promise.resolve(server as unknown as ViteDevServer),
    );
    const running = runDevCommand(
      context,
      {},
      {
        database: database === undefined ? undefined : () => database,
        loadIds: async () =>
          await Promise.resolve(["@acme/blog", "@acme/forum"]),
        loadVite: async () => await Promise.resolve({ createServer }),
      },
    );

    return { createServer, running, runtime, server };
  };

  it("starts Vite, prints the real URLs, and closes the server on Ctrl+C", async () => {
    const { createServer, running, runtime, server } = await start();
    await until(() => runtime.output().includes("AdminCP"));

    const output = runtime.output();
    expect(output).toContain("✓ Loading configuration");
    expect(output).toContain("✓ 2 plugins loaded");
    expect(output).toMatch(/Web\s+http:\/\/localhost:3000\n/);
    expect(output).toMatch(/AdminCP\s+http:\/\/localhost:3000\/admin/);
    expect(output).not.toContain("API");
    expect(output).not.toContain("Database");
    expect(createServer).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "development", root }),
    );

    runtime.signals.emit("SIGINT");
    expect(await running).toBe(0);
    expect(server.close).toHaveBeenCalledOnce();
  });

  it("only binds keyboard shortcuts in an interactive terminal", async () => {
    const piped = await start();
    await until(() => piped.runtime.output().includes("AdminCP"));
    piped.runtime.signals.emit("SIGINT");
    await piped.running;

    const tty = await start({ interactive: true });
    await until(() => tty.runtime.output().includes("AdminCP"));
    tty.runtime.signals.emit("SIGINT");
    await tty.running;

    expect(piped.server.bindCLIShortcuts).not.toHaveBeenCalled();
    expect(tty.server.bindCLIShortcuts).toHaveBeenCalledWith(
      expect.objectContaining({
        customShortcuts: [
          expect.objectContaining({ description: "open AdminCP", key: "a" }),
        ],
      }),
    );
  });

  it("fails clearly - and closes what it opened - when the server cannot start", async () => {
    const server = fakeServer({
      listenError: new Error("Port 3000 is already in use"),
    });
    const { running } = await start({ server });

    const error = (await running.catch(
      (thrown: unknown) => thrown,
    )) as RuntimeError;
    expect(error).toBeInstanceOf(RuntimeError);
    expect(error.message).toBe("Could not start the dev server.");
    expect(error.details).toEqual(["Port 3000 is already in use"]);
    expect(server.close).toHaveBeenCalledOnce();
  });

  it("prepares the database it owns before the server starts", async () => {
    write("drizzle.config.ts", "export default {};");
    write("src/vitnode.api.config.ts", "export const vitNodeApiConfig = {};");
    const order: string[] = [];
    const database: DatabaseServices = {
      drizzleConfig: async () =>
        await Promise.resolve({
          dialect: "postgresql",
          migrationsFolder: join(root, "migrations"),
          migrationsSchema: "drizzle",
          migrationsTable: "__drizzle_migrations",
        }),
      drizzleKit: async () =>
        await Promise.resolve({ code: 0, output: '{"status":"no_changes"}' }),
      listMigrationFolders: () => [],
      open: async () =>
        await Promise.resolve({
          apply: async () => {
            await Promise.resolve();
            order.push("migrate");
          },
          close: async () => await Promise.resolve(undefined),
          location: null,
          ping: async () => await Promise.resolve(undefined),
          query: async () => await Promise.resolve([]),
        }),
      readLocalMigrations: async () => await Promise.resolve([]),
    };
    const server = fakeServer();
    server.listen.mockImplementation(async () => {
      await Promise.resolve();
      order.push("listen");

      return server;
    });

    const { running, runtime } = await start({ database, server });
    await until(() => runtime.output().includes("AdminCP"));
    runtime.signals.emit("SIGINT");
    await running;

    expect(order).toEqual(["migrate", "listen"]);
    expect(runtime.output()).toContain("✓ Database connected  up to date");
    expect(runtime.output()).toMatch(/API\s+http:\/\/localhost:3000\/api/);
  });
});

describe("the dev request log", () => {
  it.each([
    [{ accept: "text/html", method: "GET", url: "/" }, true],
    [{ accept: "application/json", method: "GET", url: "/api/session" }, true],
    [{ method: "POST", url: "/_serverFn/abc" }, true],
    [{ method: "POST", url: "/login" }, true],
    [{ method: "GET", url: "/@vite/client" }, false],
    [{ method: "GET", url: "/src/main.tsx?t=123" }, false],
    [{ method: "GET", url: "/node_modules/.vite/deps/react.js?v=1" }, false],
    [{ accept: "*/*", method: "GET", url: "/assets/logo.svg" }, false],
    [{ method: "GET", url: "/__tsr/routes" }, false],
  ])("logs %j: %s", (request, expected) => {
    expect(shouldLogRequest(request)).toBe(expected);
  });

  const plainUi = () => {
    const lines: string[] = [];
    const ui = createUi({
      capabilities: {
        ci: false,
        color: false,
        columns: 80,
        interactive: false,
        unicode: true,
      },
      stderr: { write: () => true },
      stdout: {
        write: chunk => {
          lines.push(chunk);

          return true;
        },
      },
    });

    return { lines, ui };
  };

  it("aligns method, path, status and time", () => {
    const { ui } = plainUi();

    expect(
      formatRequest(ui, {
        durationMs: 18,
        method: "GET",
        status: 200,
        url: "/",
      }),
    ).toBe(`GET   /${" ".repeat(47)} 200    18ms`);
  });

  it("observes requests without answering them", async () => {
    await Promise.resolve();
    const { lines, ui } = plainUi();
    const plugin = createDevReporter(ui, { defaultPort: 3000, root: "/app" });
    let middleware:
      ((req: unknown, res: unknown, next: () => void) => void) | undefined;
    (plugin.configureServer as (server: unknown) => void)({
      middlewares: { use: (fn: typeof middleware) => (middleware = fn) },
    });

    const listeners: Record<string, () => void> = {};
    const next = vi.fn();
    middleware?.(
      { headers: { accept: "text/html" }, method: "GET", url: "/blog" },
      {
        once: (event: string, fn: () => void) => (listeners[event] = fn),
        statusCode: 200,
      },
      next,
    );

    expect(next).toHaveBeenCalledOnce();
    listeners.finish();
    expect(lines.join("")).toMatch(/^GET {3}\/blog\s+200/);
  });

  it("defaults the port to VitNode's 3000 unless the app's config sets one", () => {
    const { ui } = plainUi();
    const config = createDevReporter(ui, { defaultPort: 3000, root: "/app" })
      .config as (user: object) => unknown;

    expect(config({})).toEqual({ server: { port: 3000 } });
    expect(config({ server: { port: 4000 } })).toBeUndefined();
  });

  it("reports a hot update of the app's own file, not of generated ones", () => {
    const { lines, ui } = plainUi();
    const hotUpdate = createDevReporter(ui, { defaultPort: null, root: "/app" })
      .hotUpdate as (
      this: unknown,
      options: { file: string; modules: unknown[] },
    ) => void;
    const client = { environment: { name: "client" } };

    hotUpdate.call(client, {
      file: "/app/src/components/post.tsx",
      modules: [{}],
    });
    hotUpdate.call(client, {
      file: "/app/src/routeTree.gen.ts",
      modules: [{}],
    });
    hotUpdate.call(
      { environment: { name: "ssr" } },
      { file: "/app/src/x.tsx", modules: [{}] },
    );

    expect(lines.join("")).toBe("HMR   src/components/post.tsx\n");
  });

  it("is only active while serving", () => {
    const { ui } = plainUi();

    expect(createDevReporter(ui, { defaultPort: null, root: "/" }).apply).toBe(
      "serve",
    );
  });
});
