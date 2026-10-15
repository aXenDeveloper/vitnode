import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PLUGIN_INFO_PATH,
  PLUGIN_MANIFEST_PATH,
} from "../src/framework/plugin-manifest/generate.js";
import {
  watchPluginManifest,
  writePluginManifest,
} from "./write-plugin-manifest.js";

// Real `fs.watchFile` polling (every 300ms), so this lives in INTEGRATION.

const BLOG = { name: "@acme/blog", version: "1.0.0" };

let root: string;
let close: () => void = () => undefined;

const write = (path: string, content: string) => {
  writeFileSync(join(root, path), content);
};

const read = (path: string) => readFileSync(join(root, path), "utf8");

/** Lets the poller take its first snapshot, so the next edit is a change. */
const settle = async () =>
  await new Promise(resolve => setTimeout(resolve, 400));

const watch = async () => {
  const onChange = vi.fn();
  const onError = vi.fn();
  const { inputs } = writePluginManifest(root);
  ({ close } = watchPluginManifest({ inputs, onChange, onError, root }));
  await settle();

  return { onChange, onError };
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "vitnode-plugin-manifest-watch-"));
  mkdirSync(join(root, "src"));
  write("package.json", JSON.stringify(BLOG));
});

afterEach(() => {
  close();
  rmSync(root, { force: true, recursive: true });
});

describe("watchPluginManifest", () => {
  it("regenerates when package.json changes and when src/plugin-info.ts comes and goes", async () => {
    const { onChange, onError } = await watch();
    const importsInfo = () => read(PLUGIN_MANIFEST_PATH).includes("pluginInfo");

    write("package.json", JSON.stringify({ ...BLOG, version: "2.0.0" }));
    await vi.waitFor(
      () => {
        expect(read(PLUGIN_MANIFEST_PATH)).toContain('"2.0.0"');
      },
      { timeout: 5000 },
    );
    await settle();

    write(PLUGIN_INFO_PATH, 'export const pluginInfo = { icon: "newspaper" };');
    await vi.waitFor(
      () => {
        expect(importsInfo()).toBe(true);
      },
      { timeout: 5000 },
    );
    await settle();

    rmSync(join(root, PLUGIN_INFO_PATH));
    await vi.waitFor(
      () => {
        expect(importsInfo()).toBe(false);
      },
      { timeout: 5000 },
    );

    expect(onChange).toHaveBeenCalledTimes(3);
    expect(onError).not.toHaveBeenCalled();
  });

  it("reports a broken edit, keeps the last file, and recovers", async () => {
    const { onChange, onError } = await watch();
    const metadata = read(PLUGIN_MANIFEST_PATH);

    write("package.json", "{ broken");
    await vi.waitFor(
      () => {
        expect(onError).toHaveBeenCalled();
      },
      { timeout: 5000 },
    );
    expect(read(PLUGIN_MANIFEST_PATH)).toBe(metadata);
    expect(onChange).not.toHaveBeenCalled();
    await settle();

    write("package.json", JSON.stringify({ ...BLOG, version: "2.0.0" }));
    await vi.waitFor(
      () => {
        expect(read(PLUGIN_MANIFEST_PATH)).toContain('"2.0.0"');
      },
      { timeout: 5000 },
    );
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
