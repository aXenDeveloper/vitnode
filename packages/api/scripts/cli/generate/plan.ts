import {
  existsSync,
  linkSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { ConfigError, RuntimeError, UserError } from "../errors";

export interface FileChange {
  after: string;
  before: null | string;
  kind: "create" | "update";
  path: string;
  reasons: string[];
}

const toPosix = (path: string) => path.split(sep).join("/");

export class GenerationPlan {
  constructor(root: string) {
    this.root = resolve(root);
  }
  private readonly disk = new Map<string, null | string>();
  private readonly overlay = new Map<
    string,
    { content: string; reasons: string[] }
  >();
  readonly root: string;

  private normalize(path: string): string {
    const absolute = resolve(this.root, path);
    const rel = relative(this.root, absolute);

    if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
      throw new UserError(
        `Refusing to write ${path}: it is outside the project at ${this.root}.`,
      );
    }

    return toPosix(rel);
  }

  private readDisk(path: string): null | string {
    if (!this.disk.has(path)) {
      const absolute = join(this.root, path);
      this.disk.set(
        path,
        existsSync(absolute) ? readFileSync(absolute, "utf8") : null,
      );
    }

    return this.disk.get(path) ?? null;
  }

  changes(): FileChange[] {
    const changes: FileChange[] = [];

    for (const [path, { content, reasons }] of this.overlay) {
      const before = this.readDisk(path);
      if (before === content) continue;
      changes.push({
        after: content,
        before,
        kind: before === null ? "create" : "update",
        path,
        reasons,
      });
    }

    return changes.sort((a, b) =>
      a.kind === b.kind ? 0 : a.kind === "create" ? -1 : 1,
    );
  }

  create(path: string, content: string, reason: string): void {
    const rel = this.normalize(path);

    if (this.read(rel) !== null) {
      throw new UserError(`${rel} already exists.`, {
        details: [
          "The generator never overwrites files. Pick another name, or move the existing file first.",
        ],
      });
    }

    this.overlay.set(rel, { content, reasons: [reason] });
  }

  exists(path: string): boolean {
    return this.read(path) !== null;
  }

  read(path: string): null | string {
    const rel = this.normalize(path);

    return this.overlay.get(rel)?.content ?? this.readDisk(rel);
  }

  replaceContent(path: string, content: string): void {
    const rel = this.normalize(path);
    const existing = this.overlay.get(rel);
    if (existing !== undefined) existing.content = content;
  }

  update(path: string, content: string, reason: string): void {
    const rel = this.normalize(path);
    const existing = this.overlay.get(rel);

    if (existing === undefined && this.readDisk(rel) === null) {
      throw new ConfigError(`Cannot update ${rel}: it does not exist.`);
    }

    this.overlay.set(rel, {
      content,
      reasons: [...(existing?.reasons ?? []), reason],
    });
  }
}

export const applyPlan = (
  root: string,
  changes: readonly FileChange[],
): void => {
  for (const change of changes) {
    const absolute = join(root, change.path);
    const current = existsSync(absolute)
      ? readFileSync(absolute, "utf8")
      : null;

    if (current !== change.before) {
      throw new RuntimeError(
        `${change.path} changed while the generator was running. Nothing was written.`,
        { hint: "Run the command again - it re-reads every file." },
      );
    }
  }

  const createdDirs: string[] = [];
  const ensureDir = (dir: string) => {
    const missing: string[] = [];
    let current = dir;
    while (!existsSync(current)) {
      missing.unshift(current);
      current = dirname(current);
    }
    for (const path of missing) {
      mkdirSync(path);
      createdDirs.push(path);
    }
  };

  const stamp = `${String(process.pid)}-${Date.now().toString(36)}`;
  const staged: { target: string; temp: string }[] = [];
  const applied: FileChange[] = [];

  const rollback = () => {
    for (const { temp } of staged) rmSync(temp, { force: true });
    for (const change of applied.reverse()) {
      const target = join(root, change.path);
      if (change.before === null) rmSync(target, { force: true });
      else writeFileSync(target, change.before, "utf8");
    }
    for (const dir of createdDirs.reverse()) {
      if (readdirSync(dir).length === 0) rmdirSync(dir);
    }
  };

  try {
    for (const change of changes) {
      const target = join(root, change.path);
      ensureDir(dirname(target));
      const temp = `${target}.vitnode-${stamp}.tmp`;
      writeFileSync(temp, change.after, "utf8");
      staged.push({ target, temp });
    }

    for (const [index, { target, temp }] of staged.entries()) {
      const change = changes[index];
      if (change?.before === null) {
        linkSync(temp, target);
        rmSync(temp, { force: true });
      } else {
        renameSync(temp, target);
      }
      if (change !== undefined) applied.push(change);
    }
    staged.length = 0;
  } catch (error) {
    rollback();
    throw new RuntimeError(
      "Writing the generated files failed. The changes already written were rolled back.",
      { cause: error },
    );
  }
};
