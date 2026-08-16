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
 * Kinds an explicit `searchableFields` may name. A slug is searchable when you
 * ask for it, but never by default - matching a URL segment against what
 * someone typed into a search box is a deliberate choice, not a freebie.
 */
export const EXPLICIT_SEARCHABLE_KINDS = new Set<
  ContentFieldDescriptor["kind"]
>([...SEARCHABLE_KINDS, "slug"]);

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
