// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Project } from "../project/project";

import { RuntimeError, UserError } from "../errors";
import { ProcessGroup, runProcess } from "../project/processes";
import { resolveServerEntry } from "../start/server-entry";
import { createTestContext } from "../testing";
import { displayHost, parsePort, runStartCommand } from "./start";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "vitnode-start-"));
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "web", type: "module" }),
  );
  writeFileSync(join(root, "vite.config.ts"), "export default {};");
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

const write = (path: string, content: string) => {
  mkdirSync(join(root, path, ".."), { recursive: true });
  writeFileSync(join(root, path), content);
};

const project = (kind: Project["kind"]): Project => ({
  drizzleConfig: null,
  hasApi: false,
  kind,
  name: "web",
  packageJson: {},
  root,
  viteConfig: null,
});

const freePort = async () =>
  new Promise<number>(resolve => {
    const server = createServer();
    server.listen(0, () => {
      const address = server.address();
      server.close(() => {
        resolve(
          typeof address === "object" && address !== null ? address.port : 0,
        );
      });
    });
  });

describe("resolveServerEntry", () => {
  it("runs the entry Nitro recorded for a node build", () => {
    write(
      ".output/nitro.json",
      JSON.stringify({
        preset: "node-server",
        serverEntry: "server/index.mjs",
      }),
    );
    write(".output/server/index.mjs", "");

    expect(resolveServerEntry(project("app"))).toEqual({
      defaultPort: 3000,
      entry: join(root, ".output", "server", "index.mjs"),
      runtime: "node",
    });
  });

  it("refuses a build for a platform that runs it itself", () => {
    write(".output/nitro.json", JSON.stringify({ preset: "vercel" }));

    expect(() => resolveServerEntry(project("app"))).toThrow(
      'targets the "vercel" preset',
    );
  });

  it("asks for a build when there is none", () => {
    expect(() => resolveServerEntry(project("app"))).toThrow(
      "No production build found.",
    );
    expect(() => resolveServerEntry(project("api"))).toThrow(
      "No production build found.",
    );
  });

  it("runs an API's compiled entry", () => {
    write("dist/index.js", "");

    expect(resolveServerEntry(project("api")).entry).toBe(
      join(root, "dist", "index.js"),
    );
  });

  it("runs a Bun API's TypeScript entry directly - there is no build", () => {
    write("src/index.ts", "");

    expect(resolveServerEntry(project("api"), "bun")).toMatchObject({
      entry: join(root, "src", "index.ts"),
      runtime: "bun",
    });
  });
});

describe("start options", () => {
  it("validates the port", () => {
    expect(parsePort("4000", 3000)).toBe(4000);
    expect(parsePort(undefined, 3000)).toBe(3000);
    expect(() => parsePort("http", 3000)).toThrow(UserError);
    expect(() => parsePort("70000", 3000)).toThrow(UserError);
  });

  it("shows a wildcard bind as localhost", () => {
    expect(displayHost("0.0.0.0")).toBe("localhost");
    expect(displayHost(undefined)).toBe("localhost");
    expect(displayHost("127.0.0.1")).toBe("127.0.0.1");
  });
});

/** A production server stand-in: listens on PORT, the way Nitro's does. */
const serverScript = `
import { createServer } from "node:http";
const server = createServer((_, res) => res.end("ok"));
server.listen(Number(process.env.PORT), () => console.log("listening " + process.env.NODE_ENV));
`;

describe("vitnode start", () => {
  it("announces the server only once it accepts connections, and stops it on Ctrl+C", async () => {
    write(
      ".output/nitro.json",
      JSON.stringify({
        preset: "node-server",
        serverEntry: "server/index.mjs",
      }),
    );
    write(".output/server/index.mjs", serverScript);
    const port = await freePort();
    const { context, runtime } = createTestContext({ cwd: root });

    const running = runStartCommand(context, { port: String(port) });
    for (let i = 0; i < 300 && !runtime.output().includes("Running"); i += 1) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }

    expect(runtime.output()).toContain(
      `● Running  http://localhost:${String(port)}`,
    );
    expect(await (await fetch(`http://localhost:${String(port)}`)).text()).toBe(
      "ok",
    );

    runtime.signals.emit("SIGINT");
    expect(await running).toBe(0);
    await expect(fetch(`http://localhost:${String(port)}`)).rejects.toThrow();
  }, 20_000);

  it("refuses a port something else already listens on, instead of announcing it", async () => {
    write(".output/server/index.mjs", serverScript);
    const blocker = createServer();
    await new Promise<void>(resolve => {
      blocker.listen(0, "localhost", resolve);
    });
    const address = blocker.address();
    const port =
      typeof address === "object" && address !== null ? address.port : 0;
    const { context, runtime } = createTestContext({ cwd: root });

    try {
      await expect(
        runStartCommand(context, { port: String(port) }),
      ).rejects.toThrow(`Port ${String(port)} is already in use.`);
      expect(runtime.output()).not.toContain("Running");
    } finally {
      blocker.close();
    }
  });

  it("fails - without claiming it is running - when the server dies during boot", async () => {
    write(".output/server/index.mjs", "process.exit(3);");
    const { context, runtime } = createTestContext({ cwd: root });

    const error = (await runStartCommand(context, {
      port: String(await freePort()),
    }).catch((thrown: unknown) => thrown)) as RuntimeError;

    expect(error).toBeInstanceOf(RuntimeError);
    expect(error.message).toBe(
      "The server exited with code 3 before it was ready.",
    );
    expect(runtime.output()).not.toContain("Running");
  }, 20_000);
});

describe("ProcessGroup", () => {
  it("reports a child that exited before anyone asked", async () => {
    const group = new ProcessGroup();
    const child = group.spawn({
      args: ["-e", "process.exit(7)"],
      command: process.execPath,
      cwd: root,
    });
    await new Promise(resolve => child.once("exit", resolve));

    expect(await group.firstExit()).toBe(7);
  });
});

describe("runProcess", () => {
  it("captures output and reports the exit code instead of throwing", async () => {
    const result = await runProcess({
      args: [
        "-e",
        "console.log('hello'); console.error('oops'); process.exit(4)",
      ],
      capture: true,
      command: process.execPath,
      cwd: root,
    });

    expect(result.code).toBe(4);
    expect(result.output).toContain("hello");
    expect(result.output).toContain("oops");
  });

  it("rejects only when the command cannot start at all", async () => {
    await expect(
      runProcess({
        args: [],
        capture: true,
        command: join(root, "missing-binary"),
        cwd: root,
      }),
    ).rejects.toThrow("Could not start");
  });
});
