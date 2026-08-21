import type {
  ContentAdminActionConfig,
  ContentAdminConfig,
  ContentAdminFormMode,
  ContentAdminFormSection,
  ContentFieldDescriptor,
  ContentFieldMap,
  ResolvedContentAdminConfig,
} from "./types";

import {
  CONTENT_ADMIN_CREATE_SEGMENT,
  CONTENT_ADMIN_EDIT_SEGMENT,
  CONTENT_ADMIN_FORM_MODES,
  CONTENT_ADMIN_PATH_SEGMENT_PATTERN,
} from "./const";
import {
  assertKnownColumns,
  editorialFields,
  EXPLICIT_SEARCHABLE_KINDS,
  publicationFields,
  SEARCHABLE_KINDS,
  systemFields,
} from "./define-shared";
import { ContentEngineError } from "./errors";
import { isContentReferenceCollection } from "./paths";
import { contentTypeToPath } from "./registry";

/**
 * Every admin surface addresses a column on the base table, so it is stated in
 * terms of the *shared* fields only. A localized field named here would be a
 * DataTable column, a sort or a search over something the base table does not
 * have - see `ContentAddressableColumn`, which rejects it at compile time too.
 */
const assertNotLocalized = (
  id: string,
  label: string,
  names: readonly string[],
  localizedFields: ContentFieldMap,
): void => {
  const localized = names.find(name => localizedFields[name] !== undefined);
  if (localized !== undefined) {
    throw new ContentEngineError(
      `${label} names the localized field "${localized}", which is not a column on the base table. Localized values get their own AdminCP surface in Stage 5B.`,
      { contentTypeId: id },
    );
  }
};

/**
 * Kinds that are not one column on the base table, so they cannot be a list
 * cell, an `orderBy` or a `titleField`.
 *
 * A group is several columns under generated names; a repeatable and a to-many
 * relation are on other tables entirely. All three still belong on the *form* -
 * that is what `admin.form.fields` is for, and it is checked against the wider
 * set.
 */
const NON_COLUMN_KINDS = new Set<ContentFieldDescriptor["kind"]>([
  "group",
  "repeatable",
]);

const isAdminColumnField = (fieldValue: ContentFieldDescriptor): boolean =>
  !NON_COLUMN_KINDS.has(fieldValue.kind) &&
  !isContentReferenceCollection(fieldValue);

const adminFormModes: readonly string[] = CONTENT_ADMIN_FORM_MODES;

/**
 * `admin.create.mode` / `admin.edit.mode`, defaulted and checked.
 *
 * Defaults to `dialog`, which is what keeps every content type written before
 * page mode existed behaving exactly as it did. The runtime check is here for a
 * JavaScript caller and for a value that widened somewhere upstream - the type
 * already refuses anything outside the union.
 */
const resolveFormMode = (
  id: string,
  label: string,
  action: ContentAdminActionConfig | undefined,
): ContentAdminFormMode => {
  const mode = action?.mode ?? "dialog";

  if (!adminFormModes.includes(mode)) {
    throw new ContentEngineError(
      `${label} is "${mode}". Expected one of ${adminFormModes.map(value => `"${value}"`).join(", ")}.`,
      { contentTypeId: id },
    );
  }

  return mode;
};

/** A section name has to survive being a message key segment. */
const SECTION_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

/**
 * `admin.form.sections`, checked for the mistakes that would cost a field.
 *
 * Field *existence* is not checked here - the concatenated list goes through the
 * same `assertKnownColumns` as `admin.form.fields`, so an unknown name reads the
 * same either way. What is checked is what only sections can get wrong: a name
 * that cannot be a translation key, a duplicated name (two headings reading one
 * message), a section with nothing in it, and the same field in two sections -
 * which would render one input twice into one payload.
 */
const resolveFormSections = <TFields>(
  id: string,
  sections: ContentAdminFormSection<TFields>[] | undefined,
): { fields: string[]; name: string }[] => {
  if (sections === undefined) return [];

  const seenNames = new Set<string>();
  const seenFields = new Map<string, string>();

  return sections.map(section => {
    const { name } = section;

    if (!SECTION_NAME_PATTERN.test(name)) {
      throw new ContentEngineError(
        `admin.form.sections has a section named "${name}". A name is the i18n key segment its heading is read from, so it must start with a letter and hold only lowercase letters, digits and underscores.`,
        { contentTypeId: id },
      );
    }
    if (seenNames.has(name)) {
      throw new ContentEngineError(
        `admin.form.sections declares "${name}" twice. Two sections sharing a name would read one heading from one message; give each its own.`,
        { contentTypeId: id },
      );
    }
    seenNames.add(name);

    const fields = section.fields.map(String);
    if (fields.length === 0) {
      throw new ContentEngineError(
        `admin.form.sections section "${name}" lists no fields. A section with nothing in it renders an empty card; remove it, or move a field into it.`,
        { contentTypeId: id },
      );
    }

    for (const field of fields) {
      const owner = seenFields.get(field);
      if (owner !== undefined) {
        throw new ContentEngineError(
          `admin.form.sections places "${field}" in both "${owner}" and "${name}". One field belongs to one section - rendered twice it would submit two values for one column.`,
          { contentTypeId: id },
        );
      }
      seenFields.set(field, name);
    }

    return { fields, name };
  });
};

const adminReservedSegments: readonly string[] = [
  CONTENT_ADMIN_CREATE_SEGMENT,
  CONTENT_ADMIN_EDIT_SEGMENT,
];

const resolveAdminPath = (id: string, path: string | undefined): string => {
  if (path === undefined) return contentTypeToPath(id);

  const segments = path.split("/");
  const invalid = segments.find(
    segment => !CONTENT_ADMIN_PATH_SEGMENT_PATTERN.test(segment),
  );
  if (invalid !== undefined) {
    throw new ContentEngineError(
      `admin.path "${path}" is not a URL path. Every segment must start with a lowercase letter and hold only lowercase letters, digits and dashes, separated by "/" - no leading or trailing slash, and no empty segment.`,
      { contentTypeId: id },
    );
  }

  if (adminReservedSegments.includes(segments[segments.length - 1])) {
    throw new ContentEngineError(
      `admin.path "${path}" ends in "${segments[segments.length - 1]}", which is what tells a list screen from a generated form page. Name the entity instead.`,
      { contentTypeId: id },
    );
  }

  return path;
};

export const resolveAdmin = <TFields>(
  id: string,
  fields: ContentFieldMap,
  localizedFields: ContentFieldMap,
  admin: ContentAdminConfig<TFields>,
  publication: boolean,
  editorial: boolean,
): ResolvedContentAdminConfig => {
  const fieldNames = Object.keys(fields);
  const isLocalized = (name: string): boolean =>
    localizedFields[name] !== undefined;
  // The subset an `orderBy`, a filter and an index may name: one column on the
  // **base** table.
  const columnFieldNames = fieldNames.filter(
    name => !isLocalized(name) && isAdminColumnField(fields[name]),
  );
  // The wider subset a DataTable cell and a toast title may name. A localized
  // field is one column on the translation table, so it can be *shown* in the
  // reader's own language - it just cannot be sorted or filtered by.
  const displayFieldNames = fieldNames.filter(name =>
    isAdminColumnField(fields[name]),
  );
  const assertColumnField = (label: string, names: readonly string[]): void => {
    const advanced = names.find(
      name => fields[name] !== undefined && !isAdminColumnField(fields[name]),
    );
    if (advanced === undefined) return;

    throw new ContentEngineError(
      `${label} names "${advanced}", a "${fields[advanced].kind}" field. It is not one column on the base table, so it cannot be shown as a cell, ordered by, or used as a title. List it in \`admin.form.fields\` instead${fields[advanced].kind === "group" ? `, or name one of its leaves` : ""}.`,
      { contentTypeId: id },
    );
  };

  // The surfaces that address a column of the **base table**: a localized field
  // is not one, and a query cannot pretend otherwise.
  for (const [label, names] of [
    ["admin.list.orderableFields", admin.list?.orderableFields],
    ["admin.list.searchableFields", admin.list?.searchableFields],
    [
      "admin.list.defaultOrderBy",
      admin.list?.defaultOrderBy === undefined
        ? undefined
        : [admin.list.defaultOrderBy],
    ],
  ] as const) {
    if (!names) continue;
    assertNotLocalized(id, label, names.map(String), localizedFields);
    assertColumnField(label, names.map(String));
  }

  // The presentation surfaces. Localized names are welcome; a group or a
  // collection still is not, because neither is one cell or one title.
  for (const [label, names] of [
    ["admin.list.columns", admin.list?.columns],
    [
      "admin.titleField",
      admin.titleField === undefined || admin.titleField === null
        ? undefined
        : [admin.titleField],
    ],
  ] as const) {
    if (!names) continue;
    assertColumnField(label, names.map(String));
  }

  const generatedColumns = [
    ...systemFields,
    ...(publication ? publicationFields : []),
    ...(editorial ? editorialFields : []),
  ];
  const knownColumns = new Set([...displayFieldNames, ...generatedColumns]);

  const searchableFields = (
    admin.list?.searchableFields?.map(String) ??
    columnFieldNames.filter(name => SEARCHABLE_KINDS.has(fields[name].kind))
  ).map(String);
  assertKnownColumns(
    id,
    "admin.list.searchableFields",
    searchableFields,
    new Set(columnFieldNames),
  );
  const notSearchable = searchableFields.find(
    name => !EXPLICIT_SEARCHABLE_KINDS.has(fields[name].kind),
  );
  if (notSearchable !== undefined) {
    throw new ContentEngineError(
      `admin.list.searchableFields includes "${notSearchable}", which is not a text, textarea or slug field.`,
      { contentTypeId: id },
    );
  }

  const orderableFields = (admin.list?.orderableFields ?? []).map(String);
  assertKnownColumns(
    id,
    "admin.list.orderableFields",
    orderableFields,
    new Set(columnFieldNames),
  );

  // A file column holds a `core_files.id`, so an `ORDER BY` on it sorts by upload
  // order - a fact about the files table, not about the records, and one that
  // moves whenever a file is replaced. The same reasoning rules it out as a title
  // or a colour: both are things a person reads off a row, and an integer is
  // neither.
  const fileColumn = (label: string, names: readonly string[]): void => {
    const found = names.find(name => fields[name]?.kind === "file");
    if (found === undefined) return;

    throw new ContentEngineError(
      `${label} names the file field "${found}". Its column holds a \`core_files.id\`, which is an upload order rather than anything anybody chose - it can be shown as a cell, but not ordered by, titled by or coloured by.`,
      { contentTypeId: id },
    );
  };
  fileColumn("admin.list.orderableFields", orderableFields);
  fileColumn(
    "admin.list.defaultOrderBy",
    admin.list?.defaultOrderBy === undefined
      ? []
      : [String(admin.list.defaultOrderBy)],
  );
  fileColumn(
    "admin.titleField",
    admin.titleField === undefined || admin.titleField === null
      ? []
      : [String(admin.titleField)],
  );
  fileColumn(
    "admin.colorField",
    admin.colorField === undefined || admin.colorField === null
      ? []
      : [admin.colorField],
  );

  // A published/draft badge is the first thing anyone looks for, so it leads
  // the default column list. Advanced fields are absent by default: a to-many
  // relation and a repeatable are each an extra query, and defaulting them into
  // the list would issue one per row.
  const defaultColumns = publication
    ? ["status", ...columnFieldNames, "updatedAt"]
    : [...columnFieldNames, "updatedAt"];
  const columns = (admin.list?.columns?.map(String) ?? defaultColumns).map(
    String,
  );
  assertKnownColumns(id, "admin.list.columns", columns, knownColumns);

  const sections = resolveFormSections(id, admin.form?.sections);
  if (sections.length > 0 && admin.form?.fields !== undefined) {
    throw new ContentEngineError(
      "admin.form declares both `fields` and `sections`. Sections are the field list - keep the sections and drop `fields`.",
      { contentTypeId: id },
    );
  }

  // Sections *are* the order when they are used, so the flat list every other
  // consumer reads is their concatenation rather than a second declaration that
  // could disagree with them.
  const formFields =
    sections.length > 0
      ? sections.flatMap(section => section.fields)
      : (admin.form?.fields?.map(String) ?? fieldNames).map(String);
  assertKnownColumns(
    id,
    sections.length > 0 ? "admin.form.sections" : "admin.form.fields",
    formFields,
    new Set(fieldNames),
  );

  const defaultOrderBy = String(admin.list?.defaultOrderBy ?? "updatedAt");
  if (
    !generatedColumns.includes(defaultOrderBy) &&
    !orderableFields.includes(defaultOrderBy)
  ) {
    throw new ContentEngineError(
      `admin.list.defaultOrderBy is "${defaultOrderBy}", which is not in admin.list.orderableFields.`,
      { contentTypeId: id },
    );
  }

  const titleField =
    admin.titleField === undefined
      ? // A shared title first, because it reads the same for everybody. Failing
        // that a localized one, resolved per reader - which is still a name,
        // where the alternative is `#123`.
        (columnFieldNames.find(name =>
          SEARCHABLE_KINDS.has(fields[name].kind),
        ) ??
        displayFieldNames.find(name =>
          SEARCHABLE_KINDS.has(fields[name].kind),
        ) ??
        null)
      : // `null` is a decision, not an omission: it says this content type has
        // no title at all rather than "pick one for me".
        admin.titleField === null
        ? null
        : String(admin.titleField);
  if (titleField !== null && !displayFieldNames.includes(titleField)) {
    throw new ContentEngineError(
      `admin.titleField references unknown field "${titleField}".`,
      { contentTypeId: id },
    );
  }

  // A colour is drawn from the row itself, so - unlike the title - it has to be
  // a real column: a per-language swatch would be a different colour depending
  // on who is looking at it.
  const colorField = admin.colorField ?? null;
  if (colorField !== null && !columnFieldNames.includes(colorField)) {
    throw new ContentEngineError(
      `admin.colorField references "${colorField}", which is not a shared column. A colour is a property of the record rather than of a language.`,
      { contentTypeId: id },
    );
  }

  return {
    colorField,
    create: { mode: resolveFormMode(id, "admin.create.mode", admin.create) },
    edit: { mode: resolveFormMode(id, "admin.edit.mode", admin.edit) },
    form: { fields: formFields, sections },
    list: {
      columns,
      defaultOrder: admin.list?.defaultOrder ?? "desc",
      defaultOrderBy,
      orderableFields,
      searchableFields,
    },
    navigation: { enabled: admin.navigation?.enabled ?? true },
    path: resolveAdminPath(id, admin.path),
    titleField,
  };
};
