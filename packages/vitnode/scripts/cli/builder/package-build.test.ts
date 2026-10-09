// @vitest-environment node
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runBuildCommand } from "../commands/build";
import { RuntimeError } from "../errors";
import { createTestContext } from "../testing";

const packageRoot = join(import.meta.dirname, "..", "..", "..");
const template = join(
  packageRoot,
  "..",
  "create-vitnode-app",
  "copy-of-vitnode-plugin",
  "root",
);

let root: string;

const write = (path: string, content: string) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
};

const read = (path: string) => readFileSync(join(root, path), "utf8");

const exists = (path: string) => existsSync(join(root, path));

/**
 * A plugin package laid out the way `create-vitnode-app` generates one - the
 * template's own tsconfig files - with one module for each thing a package
 * build has to get right.
 */
const fixture = () => {
  cpSync(join(template, "tsconfig.json"), join(root, "tsconfig.json"));
  cpSync(
    join(template, "tsconfig.build.json"),
    join(root, "tsconfig.build.json"),
  );
  write(
    "package.json",
    JSON.stringify({
      exports: {
        "./*": {
          default: "./dist/src/*.js",
          import: "./dist/src/*.js",
          types: "./dist/src/*.d.ts",
        },
        "./locales/*.json": "./src/locales/*.json",
      },
      name: "@acme/fixture",
      type: "module",
      version: "0.1.0",
    }),
  );
  write(
    "types/fixture.d.ts",
    'declare global {\n  interface FixtureRegistry {\n    greeting: "hello";\n  }\n}\n\nexport {};\n',
  );
  write(
    "src/components/greeting.tsx",
    "export const Greeting = ({ name }: { name: string }) => <p>Hello {name}</p>;\n",
  );
  write(
    "src/lib/math.ts",
    "export interface Shape {\n  height: number;\n  width: number;\n}\n\nexport const double = (value: number) => value * 2;\n",
  );
  write(
    "src/uses-alias.ts",
    'import type { Shape } from "@/lib/math";\n\nimport { double } from "@/lib/math";\n\nexport const quadruple = (value: number) => double(double(value));\n\nexport const area = (shape: Shape) => shape.width * shape.height;\n',
  );
  write(
    "src/standalone.ts",
    'export const standalone = "only reachable through the wildcard export";\n',
  );
  write(
    "src/lazy.ts",
    'export const loadPage = async () => await import("./pages/page");\n',
  );
  write("src/pages/page.ts", 'export default "page";\n');
  write(
    "src/api/hello.module.ts",
    'import { helloRoute } from "./hello.route";\n\nexport const helloModule = { routes: [helloRoute] };\n',
  );
  write("src/api/hello.route.ts", 'export const helloRoute = "/hello";\n');
  write("src/auth.server.ts", 'export const secret = () => "server only";\n');
  write(
    "src/side-effect.ts",
    "(globalThis as Record<string, unknown>).fixtureLoaded = true;\n",
  );
  write("src/register.ts", 'import "./side-effect";\n');
  write(
    "src/registry.ts",
    'const registry = { greeting: "hello" } as unknown as FixtureRegistry;\n\nexport const readGreeting = () => registry.greeting;\n',
  );
  write("src/locales/en.json", '{ "fixture": { "hello": "Hi" } }\n');
  write(
    "src/locales/index.ts",
    'export default {\n  en: async () => await import("./en.json", { with: { type: "json" } }),\n};\n',
  );
  write("src/lib/math.test.ts", "export const notShipped = true;\n");
  write("src/tests/setup.ts", "export const notShippedEither = true;\n");
  write("src/__fixtures__/sample.json", "{}\n");
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "vitnode-package-build-"));
  // The package's own node_modules, as an install would leave it: tsdown,
  // TypeScript and React's types resolve from there. The sources themselves
  // must not live under a node_modules folder - an import resolving into one
  // is a dependency, and stays external.
  symlinkSync(
    join(packageRoot, "node_modules"),
    join(root, "node_modules"),
    "junction",
  );
  fixture();
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

const build = async () => {
  const { context, runtime } = createTestContext({ cwd: root });
  const code = await runBuildCommand(context, {}, { now: () => 0 });

  return { code, output: runtime.output() };
};

const RELATIVE_IMPORT =
  /(?:\bfrom|\bimport\(?)\s*["'`](\.{1,2}\/[^"'`]+)["'`]/g;

/** `file -> specifier` for each relative import under `dir` with no file behind it. */
const unresolvedRelativeImports = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && /\.(?:js|d\.ts)$/.test(entry.name))
    .flatMap(entry => {
      const file = join(entry.parentPath, entry.name);

      return [...readFileSync(file, "utf8").matchAll(RELATIVE_IMPORT)]
        .map(match => match[1])
        .filter(specifier => {
          const target = join(dirname(file), specifier);

          return (
            !existsSync(target) && !existsSync(target.replace(/\.js$/, ".d.ts"))
          );
        })
        .map(specifier => `${relative(dir, file)} -> ${specifier}`);
    });

/** Imports a built module with Node itself, as an app's server would. */
const importWithNode = (expression: string) =>
  execFileSync(
    process.execPath,
    ["--input-type=module", "--eval", expression],
    { cwd: root, encoding: "utf8" },
  ).trim();

describe("vitnode build in a plugin package", () => {
  it("compiles every module under src into dist/src with tsdown and checks types", async () => {
    const { code, output } = await build();

    expect(code).toBe(0);
    expect(output).toContain("✓ Compiling sources");
    expect(output).toContain("✓ Checking types");

    // A module nothing imports is still public through `"./*"`.
    expect(exists("dist/src/standalone.js")).toBe(true);
    expect(exists("dist/src/standalone.d.ts")).toBe(true);
    // Server-only filenames are kept as they are.
    expect(exists("dist/src/auth.server.js")).toBe(true);
    // Tests, their setup and their fixtures stay out.
    expect(exists("dist/src/lib/math.test.js")).toBe(false);
    expect(exists("dist/src/tests")).toBe(false);
    expect(exists("dist/src/__fixtures__")).toBe(false);

    // Every relative import - JavaScript and declarations - names a file
    // that was written, as Node's ESM resolution requires.
    expect(unresolvedRelativeImports(join(root, "dist", "src"))).toEqual([]);
  }, 60_000);

  it("emits ESM that Node runs, with aliases, JSX, dynamic imports and side effects intact", async () => {
    await build();

    expect(read("dist/src/components/greeting.js")).toContain(
      "react/jsx-runtime",
    );
    expect(read("dist/src/uses-alias.js")).toMatch(
      /from\s*["'`]\.\/lib\/math\.js["'`]/,
    );
    expect(read("dist/src/uses-alias.js")).not.toContain("@/");
    expect(read("dist/src/lazy.js")).toMatch(
      /import\(\s*["'`]\.\/pages\/page\.js["'`]\s*\)/,
    );
    expect(read("dist/src/register.js")).toMatch(
      /import\s*["'`]\.\/side-effect\.js["'`]/,
    );
    // A dotted file name is a module name, not an extension.
    expect(read("dist/src/api/hello.module.js")).toMatch(
      /from\s*["'`]\.\/hello\.route\.js["'`]/,
    );

    expect(
      importWithNode(
        'const { quadruple } = await import("./dist/src/uses-alias.js"); const { loadPage } = await import("./dist/src/lazy.js"); await import("./dist/src/register.js"); const { helloModule } = await import("./dist/src/api/hello.module.js"); console.log(quadruple(2), (await loadPage()).default, globalThis.fixtureLoaded, helloModule.routes[0]);',
      ),
    ).toBe("8 page true /hello");
  }, 60_000);

  it("copies JSON next to the module that imports it, with the import attribute kept", async () => {
    await build();

    expect(read("dist/src/locales/en.json")).toBe(read("src/locales/en.json"));
    expect(read("dist/src/locales/index.js")).toMatch(
      /import\(\s*["'`]\.\/en\.json["'`]\s*,\s*\{\s*with:\s*\{\s*type:\s*["'`]json["'`]/,
    );
    expect(
      importWithNode(
        'const { default: messages } = await import("./dist/src/locales/index.js"); console.log((await messages.en()).default.fixture.hello);',
      ),
    ).toBe("Hi");
  }, 60_000);

  it("writes declarations with relative imports, declaration maps and the ambient types the package declares", async () => {
    await build();

    const declaration = read("dist/src/uses-alias.d.ts");
    expect(declaration).toMatch(/from\s*["']\.\/lib\/math\.js["']/);
    expect(declaration).not.toContain("@/");
    expect(exists("dist/src/lib/math.d.ts")).toBe(true);

    const map = JSON.parse(read("dist/src/uses-alias.d.ts.map")) as {
      sources: string[];
    };
    expect(map.sources).toEqual(["../../src/uses-alias.ts"]);

    // Inferred from `types/fixture.d.ts`, which no module imports - as a
    // plugin's fetcher types come from its generated API registry.
    expect(read("dist/src/registry.d.ts")).toMatch(
      /readGreeting: \(\) => "hello"/,
    );
  }, 60_000);

  it("ships no JavaScript source maps from a production build", async () => {
    await build();

    expect(exists("dist/src/standalone.js.map")).toBe(false);
    expect(read("dist/src/standalone.js")).not.toContain("sourceMappingURL");
  }, 60_000);

  it("fails on a type error, as tsc always made it", async () => {
    write("src/broken.ts", 'export const value: number = "text";\n');

    const failure = await build().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(RuntimeError);
    expect((failure as RuntimeError).message).toBe(
      "Build failed: tsc exited with code 2",
    );
    expect((failure as RuntimeError).output).toContain("TS2322");
  }, 60_000);

  it("fails on code tsdown cannot compile, with its error", async () => {
    write("src/broken.ts", "export const = ;\n");

    const failure = await build().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(RuntimeError);
    expect((failure as RuntimeError).message).toBe(
      "Build failed: tsdown could not compile the package",
    );
    expect((failure as RuntimeError).output).toContain("src/broken.ts");
  }, 60_000);

  it("removes the output of deleted sources, rewrites only what changed and never touches anything outside dist/src", async () => {
    write("dist/scripts/scripts.js", "// another build's output\n");
    await build();
    const before = statSync(join(root, "dist/src/uses-alias.js")).mtimeMs;

    rmSync(join(root, "src/standalone.ts"));
    rmSync(join(root, "src/locales"), { recursive: true });
    write(
      "src/register.ts",
      'import "./side-effect";\n\nexport const registered = true;\n',
    );
    await build();

    expect(exists("dist/src/standalone.js")).toBe(false);
    expect(exists("dist/src/standalone.d.ts")).toBe(false);
    expect(exists("dist/src/locales")).toBe(false);
    expect(read("dist/src/register.js")).toContain("registered");
    expect(statSync(join(root, "dist/src/uses-alias.js")).mtimeMs).toBe(before);
    expect(read("dist/scripts/scripts.js")).toBe("// another build's output\n");
  }, 120_000);
});
