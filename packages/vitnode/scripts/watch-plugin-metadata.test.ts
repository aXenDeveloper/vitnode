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
  PLUGIN_ICON_PATH,
  PLUGIN_METADATA_PATH,
} from "../src/framework/plugin-metadata/generate.js";
import {
  watchPluginMetadata,
  writePluginMetadata,
} from "./write-plugin-metadata.js";

// Real `fs.watchFile` polling (every 300ms), so this lives in INTEGRATION.

const SVG = '<svg xmlns="http://www.w3.org/2000/svg"/>';
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
  const { inputs } = writePluginMetadata(root);
  ({ close } = watchPluginMetadata({ inputs, onChange, onError, root }));
  await settle();

  return { onChange, onError };
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "vitnode-plugin-metadata-watch-"));
  mkdirSync(join(root, "src"));
  mkdirSync(join(root, "assets"));
  write("package.json", JSON.stringify(BLOG));
});

afterEach(() => {
  close();
  rmSync(root, { force: true, recursive: true });
});

describe("watchPluginMetadata", () => {
  it("regenerates when package.json changes, then follows a newly declared icon", async () => {
    const { onChange, onError } = await watch();

    write("assets/icon.svg", SVG);
    write(
      "package.json",
      JSON.stringify({ ...BLOG, vitnode: { icon: "./assets/icon.svg" } }),
    );
    await vi.waitFor(
      () => {
        expect(read(PLUGIN_ICON_PATH)).toContain("data:image/svg+xml");
      },
      { timeout: 5000 },
    );
    expect(onChange).toHaveBeenCalled();
    await settle();

    write("assets/icon.svg", `${SVG}\n`);
    await vi.waitFor(
      () => {
        expect(read(PLUGIN_ICON_PATH)).toContain(
          Buffer.from(`${SVG}\n`).toString("base64"),
        );
      },
      { timeout: 5000 },
    );
    expect(onError).not.toHaveBeenCalled();
  });

  it("reports a broken edit, keeps the last files, and recovers", async () => {
    const { onChange, onError } = await watch();
    const metadata = read(PLUGIN_METADATA_PATH);

    write("package.json", "{ broken");
    await vi.waitFor(
      () => {
        expect(onError).toHaveBeenCalled();
      },
      { timeout: 5000 },
    );
    expect(read(PLUGIN_METADATA_PATH)).toBe(metadata);
    expect(onChange).not.toHaveBeenCalled();
    await settle();

    write("package.json", JSON.stringify({ ...BLOG, version: "2.0.0" }));
    await vi.waitFor(
      () => {
        expect(read(PLUGIN_METADATA_PATH)).toContain('"2.0.0"');
      },
      { timeout: 5000 },
    );
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
