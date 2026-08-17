import type {
  ContentFieldDescriptor,
  ContentFieldMap,
  ContentLeafColumn,
  ContentReferenceField,
  ContentRepeatableField,
} from "./types";

import { CONTENT_ADVANCED_LEAF_KINDS, CONTENT_PATH_SEPARATOR } from "./const";

/**
 * The one place a canonical field path is built, split or turned into a column.
 *
 * Stage 6 gives one logical value two representations: `seo.title`, which every
 * subsystem speaks, and `seoTitle`, which only Postgres speaks. Every subsystem
 * that needs the second one asks *this* module for it - the table generator, the
 * schemas, the services, the revision snapshotter, the public projector, the
 * search mapper and the AdminCP alike - so the mapping cannot be reinvented
 * three times and disagree on the fourth.
 */

/** `("seo", "title")` -> `"seo.title"`. */
export const contentFieldPath = (owner: string, leaf: string): string =>
  `${owner}${CONTENT_PATH_SEPARATOR}${leaf}`;

/** `"seo.title"` -> `["seo", "title"]`, or `null` when it is not a path. */
export const splitContentFieldPath = (
  path: string,
): [string, string] | null => {
  const separator = path.indexOf(CONTENT_PATH_SEPARATOR);
  if (separator <= 0 || separator === path.length - 1) return null;

  const owner = path.slice(0, separator);
  const leaf = path.slice(separator + 1);
  // Exactly one separator: `a.b.c` is not a path this engine can mean anything
  // by, and silently reading it as `a` + `b.c` would generate a column nobody
  // declared.
  if (leaf.includes(CONTENT_PATH_SEPARATOR)) return null;

  return [owner, leaf];
};

export const isContentFieldPath = (path: string): boolean =>
  splitContentFieldPath(path) !== null;

/**
 * `("seo", "title")` -> `"seoTitle"`.
 *
 * camelCase, because that is what every VitNode column is called in SQL too:
 * Drizzle is configured with no `casing` transform, so a column key is the
 * column name verbatim - `createdAt`, not `created_at`. A leaf column joining
 * that convention rather than inventing a second one is what keeps a generated
 * migration readable next to a hand-written table.
 */
export const contentLeafColumnName = (owner: string, leaf: string): string =>
  `${owner}${leaf.charAt(0).toUpperCase()}${leaf.slice(1)}`;

const leafKinds: ReadonlySet<string> = new Set(CONTENT_ADVANCED_LEAF_KINDS);

/** Whether a descriptor may sit inside a group or a repeatable. */
export const isContentLeafKind = (kind: string): boolean => leafKinds.has(kind);

export const isContentGroupField = (
  fieldValue: ContentFieldDescriptor,
): boolean => fieldValue.kind === "group";

export const isContentRepeatableField = (
  fieldValue: ContentFieldDescriptor,
): boolean => fieldValue.kind === "repeatable";

/**
 * Whether a reference field holds many targets - a to-many `relation`, or a
 * to-many `user`.
 *
 * A function rather than `fieldValue.multiple === true` at each call site, for
 * the same reason `isLocalizedContentField` is one: it is the rule that decides
 * whether a field is a column or a junction table, and two copies of a rule like
 * that is the pair that drifts.
 *
 * Both reference kinds, deliberately. A set of people is stored exactly like a
 * set of categories - a junction table with two foreign keys - and every caller
 * of this predicate is asking "is this a column?", which has the same answer for
 * both.
 *
 * Deliberately **not** a type guard. Narrowing the argument would also narrow
 * every `else` branch to "not a reference at all", and the to-one branch is
 * exactly what those branches are usually about.
 */
export const isContentReferenceCollection = (
  fieldValue: ContentFieldDescriptor,
): boolean =>
  (fieldValue.kind === "relation" || fieldValue.kind === "user") &&
  fieldValue.multiple;

/** The to-many reference descriptor, or `null` when the field is not one. */
export const asContentReferenceCollection = (
  fieldValue: ContentFieldDescriptor,
): ContentReferenceField | null =>
  isContentReferenceCollection(fieldValue)
    ? (fieldValue as ContentReferenceField)
    : null;

/** The repeatable descriptor, or `null` when the field is not one. */
export const asContentRepeatableField = (
  fieldValue: ContentFieldDescriptor,
): ContentRepeatableField | null =>
  fieldValue.kind === "repeatable" ? fieldValue : null;

/**
 * Whether a field's value lives somewhere other than the row it belongs to.
 *
 * The subtraction behind every "columns only" view in the engine.
 */
export const isContentCollectionField = (
  fieldValue: ContentFieldDescriptor,
): boolean =>
  isContentRepeatableField(fieldValue) ||
  isContentReferenceCollection(fieldValue);

/** The inner field map of a group or a repeatable, or an empty one. */
export const contentInnerFields = (
  fieldValue: ContentFieldDescriptor,
): ContentFieldMap => {
  if (fieldValue.kind === "group" || fieldValue.kind === "repeatable") {
    return fieldValue.fields;
  }

  return {};
};

/**
 * Every group leaf of a field map, in declaration order.
 *
 * Order matters and is load-bearing: it decides generated column order, schema
 * key order and therefore the bytes of a revision snapshot, so two equal states
 * serialise identically and a diff is a table rather than a set comparison.
 */
export const contentLeafColumns = (
  fields: ContentFieldMap,
): ContentLeafColumn[] => {
  const leaves: ContentLeafColumn[] = [];

  for (const [group, fieldValue] of Object.entries(fields)) {
    if (fieldValue.kind !== "group") continue;

    for (const leaf of Object.keys(contentInnerFields(fieldValue))) {
      leaves.push({
        columnName: contentLeafColumnName(group, leaf),
        group,
        leaf,
        localized: fieldValue.localized,
        path: contentFieldPath(group, leaf),
      });
    }
  }

  return leaves;
};

/**
 * A field map flattened into the columns it actually generates.
 *
 * A scalar keeps its own name; a group contributes one entry per leaf under the
 * generated column name. Groups themselves disappear, and so do the two
 * collection kinds - they are not columns on this table at all.
 *
 * This is what the table generator, the `SELECT` maps and the `toColumnValues`
 * coercion all read, which is why they need to know nothing about groups.
 */
export const contentStorageColumns = (
  fields: ContentFieldMap,
): ContentFieldMap => {
  const columns: ContentFieldMap = {};

  for (const [name, fieldValue] of Object.entries(fields)) {
    if (isContentCollectionField(fieldValue)) continue;

    if (fieldValue.kind !== "group") {
      columns[name] = fieldValue;
      continue;
    }

    const inner = contentInnerFields(fieldValue);
    for (const [leaf, leafValue] of Object.entries(inner)) {
      // The leaf's own nullability, unchanged. `resolveContentAdvanced` has
      // already proven the two states a group can be in are both storable: a
      // `nullable: true` group has all-nullable leaves, so `seo: null` can blank
      // every column, and an optional group has leaves that are nullable or
      // defaulted, so omitting it writes something valid. Nothing has to be
      // relaxed here, which is why `syndicationIndexable` comes out
      // `NOT NULL DEFAULT true` rather than merely defaulted.
      columns[contentLeafColumnName(name, leaf)] = leafValue;
    }
  }

  return columns;
};

export interface ContentAdvancedPartition {
  /** Group descriptors, by field name. */
  groups: ContentFieldMap;
  /** To-many reference descriptors (`relation` and `user`), by field name. */
  referenceCollections: ContentFieldMap;
  /** Repeatable descriptors, by field name. */
  repeatables: ContentFieldMap;
  /** Everything that is one column on the row: scalars only. */
  scalars: ContentFieldMap;
}

/** Splits a field map by *where and how* each field is stored. */
export const partitionContentStorage = (
  fields: ContentFieldMap,
): ContentAdvancedPartition => {
  const groups: ContentFieldMap = {};
  const referenceCollections: ContentFieldMap = {};
  const repeatables: ContentFieldMap = {};
  const scalars: ContentFieldMap = {};

  for (const [name, fieldValue] of Object.entries(fields)) {
    if (isContentReferenceCollection(fieldValue)) {
      referenceCollections[name] = fieldValue;
      continue;
    }
    if (fieldValue.kind === "repeatable") {
      repeatables[name] = fieldValue;
      continue;
    }
    if (fieldValue.kind === "group") {
      groups[name] = fieldValue;
      continue;
    }
    scalars[name] = fieldValue;
  }

  return { groups, referenceCollections, repeatables, scalars };
};

/**
 * Turns a logical (nested) value object into the flat column record Drizzle
 * writes.
 *
 * Only the keys the caller actually supplied are emitted, which is what makes a
 * partial group update partial: `{ seo: { description } }` produces exactly
 * `{ seoDescription }` and leaves `seo_title` untouched by the `UPDATE`.
 *
 * `seo: null` is the one expansion: it produces every leaf column set to `null`,
 * because "this group has no value" is stored as "none of its leaves do".
 */
export const contentValuesToColumns = (
  fields: ContentFieldMap,
  values: Record<string, unknown>,
): Record<string, unknown> => {
  const columns: Record<string, unknown> = {};

  for (const [name, value] of Object.entries(values)) {
    const fieldValue = fields[name];

    if (fieldValue?.kind !== "group") {
      // A collection is not a column, so it is dropped here and written by the
      // store instead - which is what lets a create pass one payload to both.
      if (fieldValue && isContentCollectionField(fieldValue)) continue;

      columns[name] = value;
      continue;
    }

    const inner = contentInnerFields(fieldValue);

    if (value === null) {
      for (const leaf of Object.keys(inner)) {
        columns[contentLeafColumnName(name, leaf)] = null;
      }
      continue;
    }

    if (typeof value !== "object") continue;

    for (const [leaf, leafValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (!(leaf in inner)) continue;

      columns[contentLeafColumnName(name, leaf)] = leafValue;
    }
  }

  return columns;
};

/**
 * Turns a flat database row back into the logical (nested) shape.
 *
 * A nullable group whose every leaf column is `NULL` reads back as `null` rather
 * than as an object of nulls - the round trip of the expansion above, and the
 * reason a nullable group requires every leaf to be nullable: without that rule
 * "the group is absent" and "one leaf happens to be empty" would be the same
 * row.
 */
export const contentColumnsToValues = (
  fields: ContentFieldMap,
  row: Record<string, unknown>,
): Record<string, unknown> => {
  const values: Record<string, unknown> = {};

  for (const [name, fieldValue] of Object.entries(fields)) {
    if (isContentCollectionField(fieldValue)) continue;

    if (fieldValue.kind !== "group") {
      if (name in row) values[name] = row[name];
      continue;
    }

    const inner = contentInnerFields(fieldValue);
    const leaves = Object.keys(inner);
    // A group whose columns were not selected is absent from the result, rather
    // than present and empty - a projection that left `seo` out must not make it
    // look as if the record has no SEO.
    if (!leaves.some(leaf => contentLeafColumnName(name, leaf) in row)) {
      continue;
    }

    const nested: Record<string, unknown> = {};
    let allNull = true;

    for (const leaf of leaves) {
      const value = row[contentLeafColumnName(name, leaf)] ?? null;
      if (value !== null) allNull = false;

      nested[leaf] = value;
    }

    values[name] = fieldValue.nullable && allNull ? null : nested;
  }

  return values;
};

/**
 * Reads one group leaf out of a row, whichever shape the row is in.
 *
 * A database row carries the flattened column (`seoTitle`); a logical row - a
 * translation's `values`, a restore's patch - carries the nested object
 * (`seo.title`). Both reach the snapshotter and the differ, and both have to
 * produce the same answer, so the "which shape is this" question is asked in
 * exactly one place.
 *
 * `undefined` means the leaf is not represented at all, which a caller has to be
 * able to tell from a stored `null`: a projection that did not select `seo` must
 * not look like a record whose SEO is empty.
 */
export const readContentLeaf = (
  values: Record<string, unknown>,
  group: string,
  leaf: string,
): unknown => {
  const column = contentLeafColumnName(group, leaf);
  if (column in values) return values[column] ?? null;

  if (!(group in values)) return undefined;

  const nested = values[group];
  if (nested === null || nested === undefined) return null;
  if (typeof nested !== "object" || Array.isArray(nested)) return undefined;

  return (nested as Record<string, unknown>)[leaf] ?? null;
};

/**
 * Reads one canonical path out of a logical value object.
 *
 * `"title"` reads a top-level value; `"seo.title"` reads through the group and
 * answers `null` when the group itself is `null`. Used by the search mapper and
 * the public projector, both of which are handed paths from configuration.
 */
export const readContentPath = (
  values: Record<string, unknown>,
  path: string,
): unknown => {
  const parts = splitContentFieldPath(path);
  if (!parts) return values[path];

  const [owner, leaf] = parts;
  const container = values[owner];
  if (container === null || container === undefined) return null;
  if (typeof container !== "object" || Array.isArray(container)) return null;

  return (container as Record<string, unknown>)[leaf] ?? null;
};
