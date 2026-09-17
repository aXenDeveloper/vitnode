// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import en from "../../locales/en.json";

const here = import.meta.dirname;

const SIDEBAR_DIRECTORIES = [
  here,
  join(here, "..", "block-picker"),
  join(here, "..", "properties"),
];

const KEYS_BUILT_AT_RUNTIME = [
  "picker.empty",
  "picker.no_results",
  "picker.none_installed",
  "area.gap_option.none",
  "area.gap_option.sm",
  "area.gap_option.md",
  "area.gap_option.lg",
  "area.align_option.start",
  "area.align_option.center",
  "area.align_option.stretch",
  "area.justify_option.start",
  "area.justify_option.center",
  "area.justify_option.stretch",
];

const editorKeyPattern = /\bt\("([^"]+)"/g;

const sidebarSources = (): string[] =>
  SIDEBAR_DIRECTORIES.flatMap(directory =>
    readdirSync(directory)
      .filter(name => /\.tsx?$/.test(name) && !name.includes(".test."))
      .map(name => readFileSync(join(directory, name), "utf8")),
  );

const referencedKeys = (): string[] => {
  const keys = new Set(KEYS_BUILT_AT_RUNTIME);

  for (const source of sidebarSources()) {
    for (const [, key] of source.matchAll(editorKeyPattern)) keys.add(key);
  }

  return [...keys].sort();
};

const messageAt = (key: string): unknown =>
  key
    .split(".")
    .reduce<unknown>(
      (value, segment) =>
        value === null || typeof value !== "object"
          ? undefined
          : (value as Record<string, unknown>)[segment],
      en.core.editor,
    );

describe("the editor vocabulary the sidebar asks for", () => {
  it("finds every key it renders in the shipped English messages", () => {
    const missing = referencedKeys().filter(
      key => typeof messageAt(key) !== "string",
    );

    expect(missing).toStrictEqual([]);
  });

  it("reads the panels from source rather than trusting this list", () => {
    const keys = referencedKeys();

    expect(keys).toContain("variant.label");
    expect(keys).toContain("area.properties");
    expect(keys).toContain("picker.layout_group");
    expect(keys.length).toBeGreaterThan(KEYS_BUILT_AT_RUNTIME.length);
  });
});
