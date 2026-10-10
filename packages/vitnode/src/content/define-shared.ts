import type { ContentFieldDescriptor, ContentFieldMap } from "./types";

import {
  CONTENT_EDITORIAL_FIELDS,
  CONTENT_PUBLICATION_FIELDS,
  CONTENT_SYSTEM_FIELDS,
} from "./const";
import { ContentEngineError } from "./errors";
import { splitContentFieldPath } from "./paths";

/** Kinds the default `searchableFields` picks up, and `titleField` falls back to. */
export const SEARCHABLE_KINDS = new Set<ContentFieldDescriptor["kind"]>([
  "text",
  "textarea",
]);

/**
 * Kinds a list search may name explicitly. Rich text is matched against the
 * text of its document, never its markup - see `buildSearchCondition`.
 */
export const EXPLICIT_SEARCHABLE_KINDS = new Set<
  ContentFieldDescriptor["kind"]
>([...SEARCHABLE_KINDS, "richText", "slug"]);

export const systemFields: readonly string[] = CONTENT_SYSTEM_FIELDS;
export const publicationFields: readonly string[] = CONTENT_PUBLICATION_FIELDS;
export const editorialFields: readonly string[] = CONTENT_EDITORIAL_FIELDS;

export const assertKnownColumns = (
  id: string,
  label: string,
  names: readonly string[],
  known: ReadonlySet<string>,
): void => {
  const unknown = names.find(name => !known.has(name));
  if (unknown !== undefined) {
    throw new ContentEngineError(
      `${label} references unknown field "${unknown}".`,
      { contentTypeId: id },
    );
  }
};

/**
 * Resolves a name or a canonical path to the descriptor it addresses.
 *
 * One function, so every allowlist in the `define-*` resolvers - public fields,
 * searchable, filterable, orderable, and the three search slots - asks the same
 * question and gets the same answer. `container` says where the value lives,
 * which is what separates "a column on the row" from "a column on a child row":
 * the second can be indexed for search but never filtered, ordered or searched
 * by a list query.
 */
export const resolveFieldTarget = (
  fields: ContentFieldMap,
  name: string,
): null | {
  container: "group" | "repeatable" | "row";
  descriptor: ContentFieldDescriptor;
} => {
  const path = splitContentFieldPath(name);
  if (!path) {
    const fieldValue = fields[name];

    return fieldValue ? { container: "row", descriptor: fieldValue } : null;
  }

  const [owner, leaf] = path;
  const container = fields[owner];
  if (container?.kind !== "group" && container?.kind !== "repeatable") {
    return null;
  }

  const leafValue = (container as { fields: ContentFieldMap }).fields[leaf];

  return leafValue
    ? { container: container.kind, descriptor: leafValue }
    : null;
};

export const contentOptionConfig = <TConfig extends object>(
  option: boolean | TConfig | undefined,
): null | Partial<TConfig> => {
  if (typeof option === "object") return option;

  return option === true ? {} : null;
};

const CONTENT_OPTION_PATHS: readonly (readonly string[])[] = [
  ["admin", "navigation"],
  ["delivery"],
  ["delivery", "redirects"],
  ["delivery", "sitemap"],
  ["editorial"],
  ["editorial", "preview"],
  ["editorial", "scheduling"],
  ["localization"],
  ["publicApi"],
  ["publication"],
  ["search"],
];

const CONTENT_OPTIONS_WITH_REQUIRED_KEYS = new Set([
  "localization",
  "publicApi",
  "search",
]);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const assertContentOptionShapes = (
  id: string,
  options: Record<string, unknown>,
): void => {
  for (const path of CONTENT_OPTION_PATHS) {
    const value = path.reduce<unknown>(
      (parent, key) => (isPlainObject(parent) ? parent[key] : undefined),
      options,
    );

    if (isPlainObject(value) && Object.hasOwn(value, "enabled")) {
      const name = path.join(".");
      const turnOn = CONTENT_OPTIONS_WITH_REQUIRED_KEYS.has(name)
        ? "pass its options object"
        : `write \`${name}: true\` or pass its options object`;

      throw new ContentEngineError(
        `${name}.enabled is not an option. A block is on when it is present: ${turnOn}, and omit it or set it to \`false\` to turn it off.`,
        { contentTypeId: id },
      );
    }
  }
};
