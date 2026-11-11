import type {
  ArrayExpression,
  CallExpression,
  Expression,
  ObjectExpression,
  ObjectProperty,
} from "oxc-parser";

import { posix } from "node:path";

import type { ParsedSource } from "./ast";
import type { GenerationPlan } from "./plan";
import type { GeneratorProject } from "./project";

import { ConfigError } from "../errors";
import {
  arrayValue,
  findCalls,
  findConstInit,
  listImports,
  objectArgument,
  parseSource,
  stringValue,
  unwrap,
} from "./ast";
import { effectiveProperty } from "./effective-property";
import { API_CONFIG } from "./project";

const KNOWN_MODULE_BUILDERS: Record<string, string> = {
  buildContentAdminModule: "content",
  buildContentPublicModule: "content",
};

export interface ModuleSource {
  call: CallExpression;
  dir: string;
  exportName: string;
  file: string;
  name: string;
  options: ObjectExpression;
  parsed: ParsedSource;
}

export type ModuleEntry =
  | { kind: "fixed"; label: string; name: string }
  | { kind: "module"; source: ModuleSource }
  | { kind: "unresolved"; label: string; reason: string };

export interface ModuleContainer {
  array: ArrayExpression | null;
  entries: ModuleEntry[];
  file: string;
  options: ObjectExpression;
  parsed: ParsedSource;
}

export class UnsupportedStructureError extends ConfigError {
  constructor(message: string, details: string[], manual: string[] = []) {
    super(message, {
      details: [
        ...details,
        "Nothing was written.",
        ...(manual.length === 0
          ? ["Wire it by hand, or simplify the structure to a direct call."]
          : ["To wire it by hand:", ...manual.map(line => `  ${line}`)]),
      ],
      hint: 'Supported: buildApiPlugin({ modules: [...] }) and buildModule({ name: "...", routes: [...], modules: [...] }) with imported or local const identifiers.',
    });
    this.manual = manual;
    this.reason = details;
    this.summary = message;
  }
  readonly manual: string[];
  readonly reason: string[];
  readonly summary: string;

  withManual(manual: string[]): UnsupportedStructureError {
    return new UnsupportedStructureError(this.summary, this.reason, manual);
  }
}

export const withManual = <T>(manual: string[], read: () => T): T => {
  try {
    return read();
  } catch (error) {
    if (error instanceof UnsupportedStructureError) {
      throw error.withManual(manual);
    }
    throw error;
  }
};

export const readParsed = (
  plan: GenerationPlan,
  file: string,
): ParsedSource => {
  const source = plan.read(file);
  if (source === null) {
    throw new ConfigError(`${file} does not exist.`);
  }

  return parseSource(file, source);
};

export const locate = (parsed: ParsedSource, offset: number): string =>
  `${parsed.path}:${String(parsed.source.slice(0, offset).split("\n").length)}`;

export const editableProperty = (
  parsed: ParsedSource,
  object: ObjectExpression,
  key: string,
  where: string,
): null | ObjectProperty => {
  const result = effectiveProperty(object, key);

  if (result.kind === "unsafe") {
    throw new UnsupportedStructureError(
      `The ${key} of ${where} cannot be read or edited safely.`,
      [`At ${locate(parsed, result.at)}: ${result.reason}.`],
    );
  }

  return result.kind === "property" ? result.property : null;
};

const label = (parsed: ParsedSource, node: { end: number; start: number }) => {
  const text = parsed.source.slice(node.start, node.end).replace(/\s+/g, " ");

  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
};

const EXTENSIONS = [".ts", ".tsx", "/index.ts", "/index.tsx"];

export const resolveSpecifier = (
  plan: GenerationPlan,
  project: GeneratorProject,
  fromFile: string,
  specifier: string,
): null | string => {
  let base: string;
  if (specifier.startsWith("@/") && project.alias) {
    base = posix.join("src", specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    base = posix.join(posix.dirname(fromFile), specifier);
  } else {
    return null;
  }

  base = base.replace(/\.(?:js|ts)$/, "");

  return (
    EXTENSIONS.map(ext => `${base}${ext}`).find(file => plan.exists(file)) ??
    null
  );
};

export const specifierFor = (
  project: GeneratorProject,
  fromFile: string,
  toFile: string,
  preferAlias: boolean,
): string => {
  const target = toFile.replace(/\.tsx?$/, "");
  if (preferAlias && project.alias && target.startsWith("src/")) {
    return `@/${target.slice(4)}`;
  }

  const rel = posix.relative(posix.dirname(fromFile), target);

  return rel.startsWith(".") ? rel : `./${rel}`;
};

export const readModuleSource = (
  plan: GenerationPlan,
  file: string,
  exportName: string,
): ModuleSource | string => {
  const parsed = readParsed(plan, file);
  const init = findConstInit(parsed.program, exportName);

  if (init === null) return `${file} does not declare const ${exportName}`;

  const call = unwrap(init);
  if (
    call.type !== "CallExpression" ||
    call.callee.type !== "Identifier" ||
    call.callee.name !== "buildModule"
  ) {
    return `${exportName} in ${file} is not a direct buildModule({...}) call`;
  }

  const options = objectArgument(call);
  if (options === null)
    return `buildModule in ${file} is not called with an object literal`;

  const nameProperty = effectiveProperty(options, "name");
  if (nameProperty.kind === "unsafe") {
    return `the name of ${exportName} cannot be read (${locate(parsed, nameProperty.at)}: ${nameProperty.reason})`;
  }
  const name =
    nameProperty.kind === "property"
      ? stringValue(nameProperty.property)
      : null;
  if (name === null)
    return `the name of ${exportName} in ${file} is not a string literal`;

  return {
    call,
    dir: posix.dirname(file),
    exportName,
    file,
    name,
    options,
    parsed,
  };
};

export const resolveBinding = (
  plan: GenerationPlan,
  project: GeneratorProject,
  parsed: ParsedSource,
  name: string,
): string | { exportName: string; file: string } => {
  if (findConstInit(parsed.program, name) !== null) {
    return { exportName: name, file: parsed.path };
  }

  const imported = listImports(parsed.program)
    .flatMap(info =>
      info.locals.map(local => ({ ...local, source: info.source })),
    )
    .find(local => local.local === name);
  if (imported === undefined || imported.imported === null) {
    return "its declaration was not found";
  }

  const file = resolveSpecifier(plan, project, parsed.path, imported.source);

  return file === null
    ? `"${imported.source}" does not resolve to a file in this plugin`
    : { exportName: imported.imported, file };
};

const entryOf = (
  plan: GenerationPlan,
  project: GeneratorProject,
  parsed: ParsedSource,
  element: Expression,
): ModuleEntry => {
  const value = unwrap(element);

  if (
    value.type === "CallExpression" &&
    value.callee.type === "Identifier" &&
    value.callee.name in KNOWN_MODULE_BUILDERS
  ) {
    return {
      kind: "fixed",
      label: label(parsed, value),
      name: KNOWN_MODULE_BUILDERS[value.callee.name] ?? "",
    };
  }

  if (value.type !== "Identifier") {
    return {
      kind: "unresolved",
      label: label(parsed, value),
      reason: "not a plain identifier",
    };
  }

  const local = findConstInit(parsed.program, value.name);
  if (local !== null) {
    const source = readModuleSource(plan, parsed.path, value.name);

    return typeof source === "string"
      ? { kind: "unresolved", label: value.name, reason: source }
      : { kind: "module", source };
  }

  const imported = listImports(parsed.program)
    .flatMap(info =>
      info.locals.map(local => ({ ...local, source: info.source })),
    )
    .find(local => local.local === value.name);

  if (imported === undefined || imported.imported === null) {
    return {
      kind: "unresolved",
      label: value.name,
      reason: "its declaration was not found",
    };
  }

  const file = resolveSpecifier(plan, project, parsed.path, imported.source);
  if (file === null) {
    return {
      kind: "unresolved",
      label: value.name,
      reason: `"${imported.source}" does not resolve to a file in this plugin`,
    };
  }

  const source = readModuleSource(plan, file, imported.imported);

  return typeof source === "string"
    ? { kind: "unresolved", label: value.name, reason: source }
    : { kind: "module", source };
};

const containerOf = (
  plan: GenerationPlan,
  project: GeneratorProject,
  parsed: ParsedSource,
  options: ObjectExpression,
  where: string,
): ModuleContainer => {
  const property = editableProperty(parsed, options, "modules", where);

  if (property === null) {
    return { array: null, entries: [], file: parsed.path, options, parsed };
  }

  const array = arrayValue(property);
  if (array === null) {
    throw new UnsupportedStructureError(
      `The modules of ${where} are not an array literal.`,
      [`File: ${parsed.path}`, `Found: ${label(parsed, property.value)}`],
    );
  }

  const entries = array.elements.flatMap(element => {
    if (element === null) return [];
    if (element.type === "SpreadElement") {
      return [
        {
          kind: "unresolved" as const,
          label: label(parsed, element),
          reason: "a spread element",
        },
      ];
    }

    return [entryOf(plan, project, parsed, element)];
  });

  return { array, entries, file: parsed.path, options, parsed };
};

export const readRootContainer = (
  plan: GenerationPlan,
  project: GeneratorProject,
): ModuleContainer => {
  const parsed = readParsed(plan, API_CONFIG);
  const calls = findCalls(parsed.program, "buildApiPlugin");

  if (calls.length !== 1 || calls[0] === undefined) {
    throw new UnsupportedStructureError(
      calls.length === 0
        ? `${API_CONFIG} has no buildApiPlugin({...}) call.`
        : `${API_CONFIG} calls buildApiPlugin more than once.`,
      [
        "The generator registers top-level modules in that one call's modules array.",
      ],
    );
  }

  const options = objectArgument(calls[0]);
  if (options === null) {
    throw new UnsupportedStructureError(
      `buildApiPlugin in ${API_CONFIG} is not called with an object literal.`,
      [],
    );
  }

  return containerOf(plan, project, parsed, options, "buildApiPlugin");
};

export const readModuleContainer = (
  plan: GenerationPlan,
  project: GeneratorProject,
  module: ModuleSource,
): ModuleContainer =>
  containerOf(
    plan,
    project,
    module.parsed,
    module.options,
    `module "${module.name}"`,
  );

export type ModuleLookup =
  | {
      container: ModuleContainer;
      depth: number;
      found: ModuleSource[];
      status: "missing";
    }
  | { container: ModuleContainer; module: ModuleSource; status: "found" };

export const lookupModule = (
  plan: GenerationPlan,
  project: GeneratorProject,
  path: readonly string[],
): ModuleLookup => {
  let container = readRootContainer(plan, project);
  const found: ModuleSource[] = [];

  for (const [index, segment] of path.entries()) {
    const matches = container.entries.filter(
      (entry): entry is Exclude<ModuleEntry, { kind: "unresolved" }> =>
        (entry.kind === "module" && entry.source.name === segment) ||
        (entry.kind === "fixed" && entry.name === segment),
    );
    const where =
      index === 0 ? API_CONFIG : `module "${path.slice(0, index).join("/")}"`;

    if (matches.length > 1) {
      throw new UnsupportedStructureError(
        `"${segment}" is registered more than once in ${where}.`,
        [`File: ${container.file}`],
      );
    }

    const match = matches[0];

    if (match?.kind === "fixed") {
      throw new UnsupportedStructureError(
        `"${path.slice(0, index + 1).join("/")}" is generated by ${match.label}.`,
        [
          "Generated Content Engine modules cannot take hand-written routes or children.",
        ],
      );
    }

    if (match === undefined) {
      const unresolved = container.entries.filter(
        entry => entry.kind === "unresolved",
      );
      if (unresolved.length > 0) {
        throw new UnsupportedStructureError(
          `Could not tell whether "${segment}" already exists in ${where}.`,
          unresolved.map(entry =>
            entry.kind === "unresolved"
              ? `${entry.label}: ${entry.reason}`
              : "",
          ),
        );
      }

      return { container, depth: index, found, status: "missing" };
    }

    found.push(match.source);
    if (index === path.length - 1) {
      return { container, module: match.source, status: "found" };
    }
    container = readModuleContainer(plan, project, match.source);
  }

  return { container, depth: path.length, found, status: "missing" };
};
