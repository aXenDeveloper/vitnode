import type {
  ContentFieldDescriptor,
  ContentFieldMap,
  ContentFileField,
  ContentLeafColumn,
  ContentReferenceField,
  ContentRelationJunction,
  ContentRepeatableTable,
  ResolvedContentAdvancedConfig,
} from "./types";

import {
  CONTENT_ADVANCED_LEAF_KINDS,
  CONTENT_FIELD_NAME_PATTERN,
  CONTENT_FILE_COLLECTION_ABSOLUTE_MAX,
  CONTENT_FILE_COLLECTION_DEFAULT_MAX,
  CONTENT_IDENTIFIER_MAX_LENGTH,
  CONTENT_JUNCTION_SYSTEM_FIELDS,
  CONTENT_RELATION_COLLECTION_MAX,
  CONTENT_REPEATABLE_ABSOLUTE_MAX,
  CONTENT_REPEATABLE_DEFAULT_MAX,
  CONTENT_REPEATABLE_SYSTEM_FIELDS,
} from "./const";
import { ContentEngineError } from "./errors";
import { unboundSelfTarget } from "./fields";
import { clampWithFingerprint } from "./hash";
import { toSnakeCase } from "./indexes";
import {
  contentLeafColumnName,
  contentLeafColumns,
  isContentLeafKind,
  partitionContentStorage,
} from "./paths";

const emptyAdvanced: ResolvedContentAdvancedConfig = {
  junctions: [],
  leaves: [],
  repeatables: [],
};

/** The disabled default, for a content type with no advanced field. */
export const contentAdvancedDisabled = (): ResolvedContentAdvancedConfig => ({
  ...emptyAdvanced,
  junctions: [],
  leaves: [],
  repeatables: [],
});

export const contentCollectionTableName = (
  tableName: string,
  field: string,
): string =>
  clampWithFingerprint(
    `${tableName}_${toSnakeCase(field)}`,
    CONTENT_IDENTIFIER_MAX_LENGTH,
  );

const suffixed = (tableName: string, suffix: string): string =>
  clampWithFingerprint(`${tableName}_${suffix}`, CONTENT_IDENTIFIER_MAX_LENGTH);

const junctionSystemFields: readonly string[] = CONTENT_JUNCTION_SYSTEM_FIELDS;
const repeatableSystemFields: readonly string[] =
  CONTENT_REPEATABLE_SYSTEM_FIELDS;

/** Checks the inner field map a group or a repeatable declares. */
const assertLeafFields = ({
  container,
  fields,
  id,
  kind,
  reserved,
}: {
  container: string;
  fields: ContentFieldMap;
  id: string;
  kind: "group" | "repeatable";
  reserved: readonly string[];
}): void => {
  const names = Object.keys(fields);

  if (names.length === 0) {
    throw new ContentEngineError(
      `${kind} field "${container}" declares no leaves, so it would generate ${kind === "group" ? "no columns" : "a table with nothing but its keys"}. Give it at least one field.`,
      { contentTypeId: id },
    );
  }

  for (const leaf of names) {
    if (!CONTENT_FIELD_NAME_PATTERN.test(leaf)) {
      throw new ContentEngineError(
        `Leaf "${container}.${leaf}" must be camelCase and start with a lowercase letter.`,
        { contentTypeId: id },
      );
    }

    const leafValue = fields[leaf] as ContentFieldDescriptor | undefined;
    if (!leafValue?.kind) {
      throw new ContentEngineError(
        `Leaf "${container}.${leaf}" is not a field descriptor. Build it with \`field.text()\`, \`field.number()\`, and so on.`,
        { contentTypeId: id },
      );
    }

    if (!isContentLeafKind(leafValue.kind)) {
      throw new ContentEngineError(
        `Leaf "${container}.${leaf}" is a "${leafValue.kind}" field, which cannot sit inside a ${kind}. Allowed kinds: ${CONTENT_ADVANCED_LEAF_KINDS.join(", ")}.`,
        { contentTypeId: id },
      );
    }

    if (leafValue.localized === true) {
      throw new ContentEngineError(
        kind === "group"
          ? `Leaf "${container}.${leaf}" is \`localized: true\`. Localization is a property of the whole group - put \`localized: true\` on "${container}" itself, so all of its leaves live on the same table with one revision history and one permission.`
          : `Leaf "${container}.${leaf}" is \`localized: true\`, but repeatable fields are shared. A per-language list of different lengths has no defensible reorder or restore semantics; see the Advanced Modeling limitations page.`,
        { contentTypeId: id },
      );
    }

    if (reserved.includes(leaf)) {
      throw new ContentEngineError(
        `Leaf "${container}.${leaf}" collides with a generated column. The ${kind === "group" ? "junction" : "child"} table always carries ${reserved.join(", ")}. Rename the leaf.`,
        { contentTypeId: id },
      );
    }
  }
};

const assertGroup = (
  id: string,
  name: string,
  fieldValue: ContentFieldDescriptor,
): void => {
  const fields = (fieldValue as { fields: ContentFieldMap }).fields;

  assertLeafFields({
    container: name,
    fields,
    id,
    kind: "group",
    reserved: [],
  });

  for (const [leaf, leafValue] of Object.entries(fields)) {
    if (fieldValue.nullable && !leafValue.nullable) {
      throw new ContentEngineError(
        `Group "${name}" is \`nullable: true\`, so setting it to null has to blank every leaf - but "${name}.${leaf}" is not nullable. Mark the leaf \`nullable: true\`, or drop \`nullable\` from the group.`,
        { contentTypeId: id },
      );
    }

    if (fieldValue.required || leafValue.nullable) continue;

    // `assertLeafFields` has already proven every leaf is one of
    // `CONTENT_ADVANCED_LEAF_KINDS`, all of which carry `defaultValue` - but
    // the descriptor union here is still the wide one.
    const hasDefault =
      leafValue.kind === "dateTime"
        ? leafValue.defaultNow
        : (leafValue as { defaultValue?: unknown }).defaultValue !== undefined;

    if (!hasDefault) {
      throw new ContentEngineError(
        `Group "${name}" may be omitted from a create payload, so every leaf needs a value it can fall back to - but "${name}.${leaf}" is neither nullable nor defaulted. Add \`nullable: true\` or a \`defaultValue\` to the leaf, or \`required: true\` to the group.`,
        { contentTypeId: id },
      );
    }
  }
};

const assertRepeatable = (
  id: string,
  name: string,
  fieldValue: ContentFieldDescriptor,
): void => {
  if (fieldValue.localized === true) {
    throw new ContentEngineError(
      `Repeatable field "${name}" is \`localized: true\`. Repeatable fields are shared - a per-language list of different lengths has no defensible reorder or restore semantics. See the Advanced Modeling limitations page.`,
      { contentTypeId: id },
    );
  }

  const repeatableValue = fieldValue as {
    fields: ContentFieldMap;
    max?: number;
    min?: number;
  };

  assertLeafFields({
    container: name,
    fields: repeatableValue.fields,
    id,
    kind: "repeatable",
    reserved: repeatableSystemFields,
  });

  const max = repeatableValue.max ?? CONTENT_REPEATABLE_DEFAULT_MAX;
  if (
    !Number.isInteger(max) ||
    max < 1 ||
    max > CONTENT_REPEATABLE_ABSOLUTE_MAX
  ) {
    throw new ContentEngineError(
      `Repeatable field "${name}" has max ${max}; it must be a whole number between 1 and ${CONTENT_REPEATABLE_ABSOLUTE_MAX}. A repeatable is a handful of rows a person edits in one form - model a content type for anything larger.`,
      { contentTypeId: id },
    );
  }

  const min = repeatableValue.min;
  if (min !== undefined && (!Number.isInteger(min) || min < 0 || min > max)) {
    throw new ContentEngineError(
      `Repeatable field "${name}" has min ${min}, which must be a whole number between 0 and its max of ${max}.`,
      { contentTypeId: id },
    );
  }
};

const assertReferenceCollection = (
  id: string,
  name: string,
  fieldValue: ContentReferenceField,
): void => {
  const noun = fieldValue.kind === "user" ? "User" : "Relation";
  const targets = fieldValue.kind === "user" ? "no people" : "no targets";

  if (fieldValue.required || fieldValue.nullable) {
    throw new ContentEngineError(
      `${noun} field "${name}" is \`multiple: true\`, so it is neither required nor nullable - the empty set is what "${targets}" looks like. Remove \`${fieldValue.required ? "required" : "nullable"}\` from it.`,
      { contentTypeId: id },
    );
  }

  if (fieldValue.localized === true) {
    throw new ContentEngineError(
      `${noun} field "${name}" is \`localized: true\`. A reference is a foreign key, and per-locale references are out of scope - the ${fieldValue.kind === "user" ? "people" : "targets"} a record points at are the same in every language.`,
      { contentTypeId: id },
    );
  }

  const min = fieldValue.min;
  if (
    min !== undefined &&
    (!Number.isInteger(min) || min < 1 || min > CONTENT_RELATION_COLLECTION_MAX)
  ) {
    throw new ContentEngineError(
      `${noun} field "${name}" has min ${min}; it must be a whole number between 1 and ${CONTENT_RELATION_COLLECTION_MAX}. \`min: 0\` is what leaving it out already means.`,
      { contentTypeId: id },
    );
  }

  // "set null" describes a column that is set to NULL. A junction row has no
  // such column: the honest analogue of "forget this reference" is to delete the
  // row, which is `cascade`.
  if (fieldValue.onDelete === "set null") {
    throw new ContentEngineError(
      `${noun} field "${name}" is \`multiple: true\` with \`onDelete: "set null"\`, which has nothing to null: a to-many reference is a junction row, not a nullable column. Use \`"cascade"\` to drop the reference when the target goes, or \`"restrict"\` to refuse the delete.`,
      { contentTypeId: id },
    );
  }
};

const assertFileCollection = (
  id: string,
  name: string,
  fieldValue: ContentFileField,
): void => {
  if (fieldValue.required || fieldValue.nullable) {
    throw new ContentEngineError(
      `File field "${name}" is \`multiple: true\`, so it is neither required nor nullable - the empty set is what "no files" looks like. Remove \`${fieldValue.required ? "required" : "nullable"}\` from it, and use \`min: 1\` if at least one file is mandatory.`,
      { contentTypeId: id },
    );
  }

  const max = fieldValue.max ?? CONTENT_FILE_COLLECTION_DEFAULT_MAX;
  if (
    !Number.isInteger(max) ||
    max < 1 ||
    max > CONTENT_FILE_COLLECTION_ABSOLUTE_MAX
  ) {
    throw new ContentEngineError(
      `File field "${name}" has max ${max}; it must be a whole number between 1 and ${CONTENT_FILE_COLLECTION_ABSOLUTE_MAX}. Every entry is a stored object the record pins against deletion, and the whole list is read and rewritten as one - model a content type for a media library.`,
      { contentTypeId: id },
    );
  }

  const min = fieldValue.min;
  if (min !== undefined && (!Number.isInteger(min) || min < 1 || min > max)) {
    throw new ContentEngineError(
      `File field "${name}" has min ${min}, which must be a whole number between 1 and its max of ${max}. \`min: 0\` is what leaving it out already means.`,
      { contentTypeId: id },
    );
  }
};

const assertSingleFile = (
  id: string,
  name: string,
  fieldValue: ContentFileField,
): void => {
  const listArg =
    fieldValue.min !== undefined
      ? "min"
      : fieldValue.max !== undefined
        ? "max"
        : fieldValue.ordered
          ? "ordered"
          : null;
  if (listArg === null) return;

  throw new ContentEngineError(
    `File field "${name}" has \`${listArg}\` but is not \`multiple: true\`. One file has no count and no order. Add \`multiple: true\`, or drop \`${listArg}\`.`,
    { contentTypeId: id },
  );
};

const assertReference = (
  id: string,
  name: string,
  fieldValue: ContentReferenceField,
): void => {
  if (fieldValue.multiple) {
    assertReferenceCollection(id, name, fieldValue);

    return;
  }

  if (fieldValue.min !== undefined) {
    throw new ContentEngineError(
      `${fieldValue.kind === "user" ? "User" : "Relation"} field "${name}" has \`min\` but is not \`multiple: true\`. One reference is one or none, which is what \`required\` says. Add \`multiple: true\`, or use \`required: true\`.`,
      { contentTypeId: id },
    );
  }

  if (fieldValue.ordered) {
    throw new ContentEngineError(
      `${fieldValue.kind === "user" ? "User" : "Relation"} field "${name}" is \`ordered: true\` but not \`multiple: true\`. One ${fieldValue.kind === "user" ? "person" : "target"} has no order. Add \`multiple: true\`, or drop \`ordered\`.`,
      { contentTypeId: id },
    );
  }
};

export const resolveContentAdvanced = ({
  fields,
  id,
  tableName,
}: {
  fields: ContentFieldMap;
  id: string;
  tableName: string;
}): ResolvedContentAdvancedConfig => {
  const { groups, referenceCollections, repeatables } =
    partitionContentStorage(fields);

  for (const [name, fieldValue] of Object.entries(fields)) {
    if (fieldValue.kind === "relation" || fieldValue.kind === "user") {
      assertReference(id, name, fieldValue);
    }
    if (fieldValue.kind === "file") {
      if (fieldValue.multiple) {
        assertFileCollection(id, name, fieldValue);
      } else {
        assertSingleFile(id, name, fieldValue);
      }
    }
    if (fieldValue.kind === "group") assertGroup(id, name, fieldValue);
    if (fieldValue.kind === "repeatable")
      assertRepeatable(id, name, fieldValue);
  }

  const leaves = contentLeafColumns(fields);
  assertLeafColumnsAreFree(id, fields, groups, leaves);

  const junctions: ContentRelationJunction[] = Object.keys(
    referenceCollections,
  ).map(field => {
    const junctionTable = contentCollectionTableName(tableName, field);

    return {
      field,
      positionIndexName: suffixed(junctionTable, "position_key"),
      primaryKeyName: suffixed(junctionTable, "pk"),
      relatedIndexName: suffixed(junctionTable, "related_item_id_idx"),
      tableName: junctionTable,
    };
  });

  const repeatableTables: ContentRepeatableTable[] = Object.keys(
    repeatables,
  ).map(field => {
    const childTable = contentCollectionTableName(tableName, field);

    return {
      field,
      positionIndexName: suffixed(childTable, "position_key"),
      tableName: childTable,
    };
  });

  assertGeneratedTableNames(id, tableName, junctions, repeatableTables);

  return { junctions, leaves, repeatables: repeatableTables };
};

const assertLeafColumnsAreFree = (
  id: string,
  fields: ContentFieldMap,
  groups: ContentFieldMap,
  leaves: readonly ContentLeafColumn[],
): void => {
  const declared = new Set(Object.keys(fields));
  const seen = new Map<string, string>();

  for (const leaf of leaves) {
    if (declared.has(leaf.columnName)) {
      throw new ContentEngineError(
        `Leaf "${leaf.path}" is stored in a column called "${leaf.columnName}", which this content type already declares as a field. Rename one of them.`,
        { contentTypeId: id },
      );
    }

    const collision = seen.get(leaf.columnName);
    if (collision !== undefined) {
      throw new ContentEngineError(
        `Leaves "${collision}" and "${leaf.path}" both compile to the column "${leaf.columnName}". Rename one of them.`,
        { contentTypeId: id },
      );
    }
    seen.set(leaf.columnName, leaf.path);
  }

  // A junction table's own columns are fixed, so a *group* whose flattened name
  // matched one would be a problem only on the base table - which the check
  // above already covers. What is left is the group-name-versus-leaf-name case:
  // `seo` and `seoTitle` declared side by side is caught above, and a leaf
  // called the same as its own group is harmless.
  for (const group of Object.keys(groups)) {
    if (!junctionSystemFields.includes(group)) continue;

    throw new ContentEngineError(
      `Group "${group}" shares its name with a generated junction column. Rename it - a junction table always carries ${junctionSystemFields.join(", ")}.`,
      { contentTypeId: id },
    );
  }
};

const assertGeneratedTableNames = (
  id: string,
  tableName: string,
  junctions: readonly ContentRelationJunction[],
  repeatables: readonly ContentRepeatableTable[],
): void => {
  const byName = new Map<string, string>([[tableName, "the content type"]]);

  for (const entry of [...junctions, ...repeatables]) {
    const owner = byName.get(entry.tableName);
    if (owner !== undefined) {
      throw new ContentEngineError(
        `Field "${entry.field}" generates the table "${entry.tableName}", which is already used by ${owner}. Rename the field.`,
        { contentTypeId: id },
      );
    }
    byName.set(entry.tableName, `"${entry.field}"`);
  }
};

export const assertContentRelationTargets = (
  id: string,
  fields: ContentFieldMap,
): void => {
  for (const [name, fieldValue] of Object.entries(fields)) {
    if (fieldValue.kind !== "relation") continue;

    // The placeholder `field.relation` installs for a self-relation is not a
    // target the caller supplied; comparing identity is what tells them apart.
    const hasTarget =
      fieldValue.target !== undefined &&
      fieldValue.target !== unboundSelfTarget;

    if (fieldValue.self && hasTarget) {
      throw new ContentEngineError(
        `Relation field "${name}" declares both \`self: true\` and a \`target\`. A self-relation's target is this content type, so drop the \`target\`.`,
        { contentTypeId: id },
      );
    }

    if (!fieldValue.self && !hasTarget) {
      throw new ContentEngineError(
        `Relation field "${name}" needs a \`target\` - or \`self: true\` if it points at this content type.`,
        { contentTypeId: id },
      );
    }
  }
};

/** The resolved ceiling on a repeatable's child count. */
export const contentRepeatableMax = (
  fieldValue: ContentFieldDescriptor,
): number =>
  fieldValue.kind === "repeatable"
    ? (fieldValue.max ?? CONTENT_REPEATABLE_DEFAULT_MAX)
    : CONTENT_REPEATABLE_DEFAULT_MAX;

export const contentRepeatableMin = (
  fieldValue: ContentFieldDescriptor,
): number => (fieldValue.kind === "repeatable" ? (fieldValue.min ?? 0) : 0);

export const contentRelationCollectionMax = (): number =>
  CONTENT_RELATION_COLLECTION_MAX;

/** The resolved ceiling on a file collection's entry count. */
export const contentFileCollectionMax = (
  fieldValue: ContentFieldDescriptor,
): number =>
  fieldValue.kind === "file"
    ? (fieldValue.max ?? CONTENT_FILE_COLLECTION_DEFAULT_MAX)
    : CONTENT_FILE_COLLECTION_DEFAULT_MAX;

/** The resolved floor on a file collection's entry count. */
export const contentFileCollectionMin = (
  fieldValue: ContentFieldDescriptor,
): number => (fieldValue.kind === "file" ? (fieldValue.min ?? 0) : 0);

/** Looks a generated junction up by its field name. */
export const findContentJunction = (
  advanced: ResolvedContentAdvancedConfig,
  field: string,
): ContentRelationJunction | undefined =>
  advanced.junctions.find(entry => entry.field === field);

/** Looks a generated child table up by its field name. */
export const findContentRepeatableTable = (
  advanced: ResolvedContentAdvancedConfig,
  field: string,
): ContentRepeatableTable | undefined =>
  advanced.repeatables.find(entry => entry.field === field);

/** The column one canonical leaf path is stored in, or `undefined`. */
export const findContentLeafColumn = (
  advanced: ResolvedContentAdvancedConfig,
  path: string,
): ContentLeafColumn | undefined =>
  advanced.leaves.find(entry => entry.path === path);

/** Re-exported so callers need one import for the whole path vocabulary. */
export { contentLeafColumnName };
