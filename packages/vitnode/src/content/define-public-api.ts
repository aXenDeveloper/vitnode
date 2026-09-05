import type {
  ContentFieldMap,
  ContentPublicApiConfig,
  ResolvedContentPublicApiConfig,
} from "./types";

import {
  CONTENT_FILTERABLE_FIELD_KINDS,
  CONTENT_PUBLIC_ALWAYS_ORDERABLE,
  CONTENT_PUBLIC_EXPOSABLE_COLUMNS,
  CONTENT_PUBLIC_EXPOSABLE_KINDS,
  CONTENT_PUBLIC_PATH_MAX_LENGTH,
  CONTENT_PUBLIC_PATH_PATTERN,
  CONTENT_PUBLIC_RESERVED_PATHS,
  isFilterableFieldKind,
} from "./const";
import {
  EXPLICIT_SEARCHABLE_KINDS,
  publicationFields,
  resolveFieldTarget,
} from "./define-shared";
import { ContentEngineError } from "./errors";
import { isContentReferenceCollection, splitContentFieldPath } from "./paths";

const publicExposableKinds: ReadonlySet<string> = new Set(
  CONTENT_PUBLIC_EXPOSABLE_KINDS,
);
const publicExposableColumns: readonly string[] =
  CONTENT_PUBLIC_EXPOSABLE_COLUMNS;
const publicReservedPaths: readonly string[] = CONTENT_PUBLIC_RESERVED_PATHS;

const assertPublicPath = (id: string, path: string): void => {
  if (!CONTENT_PUBLIC_PATH_PATTERN.test(path)) {
    throw new ContentEngineError(
      `publicApi.path "${path}" must be one lowercase URL segment: a letter, then letters, digits or dashes. No slashes, no dots, no leading or trailing separator.`,
      { contentTypeId: id },
    );
  }

  if (path.length > CONTENT_PUBLIC_PATH_MAX_LENGTH) {
    throw new ContentEngineError(
      `publicApi.path "${path}" is longer than ${CONTENT_PUBLIC_PATH_MAX_LENGTH} characters.`,
      { contentTypeId: id },
    );
  }

  if (publicReservedPaths.includes(path)) {
    throw new ContentEngineError(
      `publicApi.path "${path}" is reserved. The admin gate matches any request path containing "/admin/", so a public route under that name would demand a staff session.`,
      { contentTypeId: id },
    );
  }
};

const assertPublicLeafPath = (
  id: string,
  fields: ContentFieldMap,
  name: string,
  [owner, leaf]: [string, string],
): void => {
  const container = fields[owner];
  if (!container) {
    throw new ContentEngineError(
      `publicApi.fields includes "${name}", but this content type declares no field called "${owner}".`,
      { contentTypeId: id },
    );
  }

  if (container.kind !== "group" && container.kind !== "repeatable") {
    throw new ContentEngineError(
      `publicApi.fields includes "${name}", but "${owner}" is a "${container.kind}" field rather than a group or a repeatable. Only those have leaves.`,
      { contentTypeId: id },
    );
  }

  const inner = (container as { fields: ContentFieldMap }).fields;
  const leafValue = inner[leaf];
  if (!leafValue) {
    throw new ContentEngineError(
      `publicApi.fields includes "${name}", but "${owner}" declares no leaf called "${leaf}". It has: ${Object.keys(inner).join(", ")}.`,
      { contentTypeId: id },
    );
  }

  if (!publicExposableKinds.has(leafValue.kind)) {
    throw new ContentEngineError(
      `publicApi.fields includes "${name}" of kind "${leafValue.kind}", which cannot be exposed publicly.`,
      { contentTypeId: id },
    );
  }
};

export const resolvePublicApi = <TField extends string>(
  id: string,
  fields: ContentFieldMap,
  publicApi: ContentPublicApiConfig<TField> | undefined,
  publication: boolean,
  localizedFields: ContentFieldMap,
): ResolvedContentPublicApiConfig => {
  if (!publicApi?.enabled) {
    return {
      defaultOrder: "desc",
      defaultOrderBy: CONTENT_PUBLIC_ALWAYS_ORDERABLE,
      enabled: false,
      fields: [],
      filterableFields: [],
      orderableFields: [],
      path: "",
      searchableFields: [],
      slugField: "",
    };
  }

  if (!publication) {
    throw new ContentEngineError(
      "publicApi needs `publication: { enabled: true }`. A public API without a draft state would put every row on the internet the moment it is created.",
      { contentTypeId: id },
    );
  }

  assertPublicPath(id, publicApi.path);

  const exposed = publicApi.fields.map(String);
  if (exposed.length === 0) {
    throw new ContentEngineError(
      "publicApi.fields is empty. There is no wildcard - list the fields you mean to publish.",
      { contentTypeId: id },
    );
  }

  const duplicate = exposed.find(
    (name, position) => exposed.indexOf(name) !== position,
  );
  if (duplicate !== undefined) {
    throw new ContentEngineError(
      `publicApi.fields lists "${duplicate}" twice.`,
      { contentTypeId: id },
    );
  }

  // The localized public response carries the language it was actually served
  // in, under `locale`. A declared field of that name would shadow it, and the
  // reader would have no way to tell a Polish article from an English one served
  // through the fallback - which is the one thing that response has to say.
  if (Object.keys(localizedFields).length > 0 && exposed.includes("locale")) {
    throw new ContentEngineError(
      'publicApi.fields includes "locale", which a localized content type reserves: every public localized response carries the language it resolved to under that name. Rename the field.',
      { contentTypeId: id },
    );
  }

  for (const name of exposed) {
    if (publicExposableColumns.includes(name)) continue;

    const path = splitContentFieldPath(name);
    if (path) {
      assertPublicLeafPath(id, fields, name, path);
      continue;
    }

    const fieldValue = fields[name];
    if (!fieldValue) {
      if (publicationFields.includes(name)) {
        throw new ContentEngineError(
          `publicApi.fields includes "${name}", which cannot be exposed. Every row the public API returns is published, so it would be a constant.`,
          { contentTypeId: id },
        );
      }

      throw new ContentEngineError(
        `publicApi.fields references unknown field "${name}".`,
        { contentTypeId: id },
      );
    }

    if (fieldValue.kind === "user") {
      throw new ContentEngineError(
        `publicApi.fields includes the user field "${name}". User fields are not exposable: publishing a person by listing one word is exactly the accident this rule prevents. Write your own route with the shape you mean.`,
        { contentTypeId: id },
      );
    }

    // A group or a repeatable is never exposed whole. Naming `seo` would
    // publish `seo.indexable` because somebody wanted `seo.title`, and a field
    // added to the group later would become public without anyone deciding it
    // should - which is precisely what an allowlist with no wildcard exists to
    // stop. Its leaves are named one at a time.
    if (fieldValue.kind === "group" || fieldValue.kind === "repeatable") {
      const leaves = Object.keys(
        (fieldValue as { fields: ContentFieldMap }).fields,
      );

      throw new ContentEngineError(
        `publicApi.fields includes the ${fieldValue.kind} "${name}". A ${fieldValue.kind} is exposed one leaf at a time, so a leaf added later stays private until somebody says otherwise: list ${leaves.map(leaf => `"${name}.${leaf}"`).join(", ")} - or only the ones you mean.`,
        { contentTypeId: id },
      );
    }

    if (!publicExposableKinds.has(fieldValue.kind)) {
      throw new ContentEngineError(
        `publicApi.fields includes "${name}" of kind "${fieldValue.kind}", which cannot be exposed publicly.`,
        { contentTypeId: id },
      );
    }
  }

  const exposedSet = new Set(exposed);
  const assertExposed = (label: string, names: readonly string[]): void => {
    const missing = names.find(name => !exposedSet.has(name));
    if (missing !== undefined) {
      throw new ContentEngineError(
        `${label} includes "${missing}", which is not in publicApi.fields. A private field must not be reachable through a filter, a sort or a search either.`,
        { contentTypeId: id },
      );
    }
  };

  const searchableFields = (publicApi.searchableFields ?? []).map(String);
  assertExposed("publicApi.searchableFields", searchableFields);
  const notSearchable = searchableFields.find(name => {
    const target = resolveFieldTarget(fields, name);

    return (
      target === null ||
      target.container === "repeatable" ||
      !EXPLICIT_SEARCHABLE_KINDS.has(target.descriptor.kind)
    );
  });
  if (notSearchable !== undefined) {
    throw new ContentEngineError(
      resolveFieldTarget(fields, notSearchable)?.container === "repeatable"
        ? `publicApi.searchableFields includes the repeatable leaf "${notSearchable}", which lives on a child table rather than on the row. A list search is a predicate on the row; index it with \`search.contentFields\` instead.`
        : `publicApi.searchableFields includes "${notSearchable}", which is not a text, textarea or slug field.`,
      { contentTypeId: id },
    );
  }

  const filterableFields = (publicApi.filterableFields ?? []).map(String);
  assertExposed("publicApi.filterableFields", filterableFields);
  const notFilterable = filterableFields.find(name => {
    const target = resolveFieldTarget(fields, name);
    if (target === null || target.container === "repeatable") return true;
    // A to-many relation filters through an indexed EXISTS over its junction
    // table rather than by equality, but it is still a `relation` kind - so the
    // ordinary kind check accepts it and the query builder branches on `multiple`.

    return !isFilterableFieldKind(target.descriptor.kind);
  });
  if (notFilterable !== undefined) {
    throw new ContentEngineError(
      resolveFieldTarget(fields, notFilterable)?.container === "repeatable"
        ? `publicApi.filterableFields includes the repeatable leaf "${notFilterable}", which lives on a child table. Filtering by one would ask "does any child match", which is a different question from equality - write your own route for it.`
        : `publicApi.filterableFields includes "${notFilterable}", which is not an equality-filterable field. Filterable kinds: ${CONTENT_FILTERABLE_FIELD_KINDS.join(", ")}.`,
      { contentTypeId: id },
    );
  }

  const declaredOrderable = (publicApi.orderableFields ?? []).map(String);
  assertExposed("publicApi.orderableFields", declaredOrderable);
  // Before the generic collection check below, so a file field hears why *it* is
  // not orderable rather than being told it is a set. A file column holds a
  // `core_files.id`, so ordering by one orders by upload order - a fact about the
  // files table rather than about the records, and one that changes meaning the
  // moment a file is replaced. Order by `publishedAt`.
  const fileOrderable = declaredOrderable.find(
    name => resolveFieldTarget(fields, name)?.descriptor.kind === "file",
  );
  if (fileOrderable !== undefined) {
    throw new ContentEngineError(
      `publicApi.orderableFields includes the file field "${fileOrderable}". A file reference is a \`core_files.id\`, so ordering by it orders by when the file happened to be uploaded - which says nothing about the records and changes when a file is replaced. A \`multiple: true\` one is not even one value.`,
      { contentTypeId: id },
    );
  }
  const notOrderable = declaredOrderable.find(name => {
    const target = resolveFieldTarget(fields, name);

    return (
      target !== null &&
      (target.container === "repeatable" ||
        isContentReferenceCollection(target.descriptor))
    );
  });
  if (notOrderable !== undefined) {
    throw new ContentEngineError(
      `publicApi.orderableFields includes "${notOrderable}", which is not one column on the row: a repeatable leaf and a to-many relation are both sets, and a list cannot be ordered by a set.`,
      { contentTypeId: id },
    );
  }
  // A localized column is not on the base table, and ordering by one would not
  // just be awkward to generate - it would be wrong. The list a reader pages
  // through would reshuffle itself for every language, and a fallback set would
  // interleave two collations, so the same cursor would mean two different
  // positions. Order by something the record has one of.
  const localizedOrderable = declaredOrderable.find(name => {
    // A leaf of a localized group is on the translation table, so it is exactly
    // as unorderable as the localized field it belongs to.
    const path = splitContentFieldPath(name);

    return localizedFields[path ? path[0] : name] !== undefined;
  });
  if (localizedOrderable !== undefined) {
    throw new ContentEngineError(
      `publicApi.orderableFields includes the localized field "${localizedOrderable}". A public list is ordered by a column of the record, not of one of its translations - ordering by a localized field would reorder the list per language and make a cursor mean two different positions across a fallback.`,
      { contentTypeId: id },
    );
  }
  const orderableFields = [
    ...new Set([...declaredOrderable, CONTENT_PUBLIC_ALWAYS_ORDERABLE]),
  ];

  const defaultOrderBy =
    publicApi.defaultOrderBy ?? CONTENT_PUBLIC_ALWAYS_ORDERABLE;
  if (!orderableFields.includes(defaultOrderBy)) {
    throw new ContentEngineError(
      `publicApi.defaultOrderBy is "${defaultOrderBy}", which is not in publicApi.orderableFields.`,
      { contentTypeId: id },
    );
  }

  const slugFields = exposed.filter(name => fields[name]?.kind === "slug");
  if (slugFields.length !== 1) {
    throw new ContentEngineError(
      slugFields.length === 0
        ? "publicApi.fields must expose exactly one slug field - it is what the public detail route resolves by. Add `field.slug({ source: ... })` and list it."
        : `publicApi.fields exposes ${slugFields.length} slug fields (${slugFields.join(", ")}). Expose exactly one, so the detail route has a single identifier.`,
      { contentTypeId: id },
    );
  }

  return {
    defaultOrder: publicApi.defaultOrder ?? "desc",
    defaultOrderBy,
    enabled: true,
    fields: exposed,
    filterableFields,
    orderableFields,
    path: publicApi.path,
    searchableFields,
    slugField: slugFields[0],
  };
};
