import type {
  ContentFieldMap,
  ContentSearchConfig,
  ResolvedContentPublicApiConfig,
  ResolvedContentSearchConfig,
} from "./types";

import {
  CONTENT_SEARCH_DESCRIPTION_KINDS,
  CONTENT_SEARCH_ITEM_TYPE_MAX_LENGTH,
  CONTENT_SEARCH_LOCALE_PLACEHOLDER,
  CONTENT_SEARCH_PATH_MAX_LENGTH,
  CONTENT_SEARCH_SLUG_PLACEHOLDER,
  CONTENT_SEARCH_TEXT_KINDS,
  CONTENT_SEARCH_TITLE_KINDS,
} from "./const";
import { resolveFieldTarget } from "./define-shared";
import { ContentEngineError } from "./errors";

const searchTitleKinds: ReadonlySet<string> = new Set(
  CONTENT_SEARCH_TITLE_KINDS,
);
const searchDescriptionKinds: ReadonlySet<string> = new Set(
  CONTENT_SEARCH_DESCRIPTION_KINDS,
);
const searchTextKinds: ReadonlySet<string> = new Set(CONTENT_SEARCH_TEXT_KINDS);

const disabledSearch: ResolvedContentSearchConfig = {
  contentFields: [],
  descriptionField: null,
  enabled: false,
  pathTemplate: "",
  titleField: "",
};

const assertSearchField = ({
  allowRepeatable = false,
  exposed,
  fields,
  id,
  kinds,
  label,
  name,
}: {
  /** Whether a leaf of a child table may fill this slot. Only the body may. */
  allowRepeatable?: boolean;
  exposed: ReadonlySet<string>;
  fields: ContentFieldMap;
  id: string;
  kinds: ReadonlySet<string>;
  label: string;
  name: string;
}): void => {
  const target = resolveFieldTarget(fields, name);
  if (!target) {
    throw new ContentEngineError(
      `${label} references unknown field "${name}".`,
      { contentTypeId: id },
    );
  }

  const fieldValue = target.descriptor;

  if (target.container === "repeatable" && !allowRepeatable) {
    throw new ContentEngineError(
      `${label} names the repeatable leaf "${name}", which is many values rather than one. A heading and a description each have to be a single value; use \`search.contentFields\` for prose that repeats.`,
      { contentTypeId: id },
    );
  }

  if (!kinds.has(fieldValue.kind)) {
    throw new ContentEngineError(
      `${label} names "${name}" of kind "${fieldValue.kind}". Expected one of: ${[...kinds].sort().join(", ")}.`,
      { contentTypeId: id },
    );
  }

  if (!exposed.has(name)) {
    throw new ContentEngineError(
      `${label} names "${name}", which is not in publicApi.fields. Every indexed field must be publicly exposed - otherwise a result snippet, a highlighted match, ranking or an exact-match probe would leak a private value.`,
      { contentTypeId: id },
    );
  }
};

const assertSearchPathTemplate = (
  id: string,
  template: string,
  localized: boolean,
): void => {
  if (!template.startsWith("/")) {
    throw new ContentEngineError(
      `search.pathTemplate "${template}" must start with "/". Search result URLs are relative to the site root.`,
      { contentTypeId: id },
    );
  }

  if (template.length > CONTENT_SEARCH_PATH_MAX_LENGTH) {
    throw new ContentEngineError(
      `search.pathTemplate "${template}" is longer than ${CONTENT_SEARCH_PATH_MAX_LENGTH} characters.`,
      { contentTypeId: id },
    );
  }

  const occurrences =
    template.split(CONTENT_SEARCH_SLUG_PLACEHOLDER).length - 1;
  if (occurrences !== 1) {
    throw new ContentEngineError(
      `search.pathTemplate "${template}" must contain exactly one "${CONTENT_SEARCH_SLUG_PLACEHOLDER}" placeholder, not ${occurrences}.`,
      { contentTypeId: id },
    );
  }

  // A localized content type is indexed once per language, and two languages
  // routinely answer to the same slug - so a template with no `{locale}` would
  // give every translation of a record the same link, and a hit would point at
  // whichever language the reader happened to be in.
  const locales = template.split(CONTENT_SEARCH_LOCALE_PLACEHOLDER).length - 1;
  if (localized && locales !== 1) {
    throw new ContentEngineError(
      `search.pathTemplate "${template}" must contain exactly one "${CONTENT_SEARCH_LOCALE_PLACEHOLDER}" placeholder on a localized content type, not ${locales}. One document per language means one URL per language.`,
      { contentTypeId: id },
    );
  }
  if (!localized && locales > 0) {
    throw new ContentEngineError(
      `search.pathTemplate "${template}" uses "${CONTENT_SEARCH_LOCALE_PLACEHOLDER}", but this content type is not localized - there is no language for it to substitute.`,
      { contentTypeId: id },
    );
  }

  // Everything else that looks like a placeholder is a typo, and substitution is
  // a single literal replace - so an unvalidated one would end up in the URL.
  const rest = template
    .replace(CONTENT_SEARCH_SLUG_PLACEHOLDER, "")
    .replace(CONTENT_SEARCH_LOCALE_PLACEHOLDER, "");
  if (rest.includes("{") || rest.includes("}")) {
    throw new ContentEngineError(
      `search.pathTemplate "${template}" uses a placeholder other than "${CONTENT_SEARCH_SLUG_PLACEHOLDER}"${localized ? ` and "${CONTENT_SEARCH_LOCALE_PLACEHOLDER}"` : ""}. No other placeholder is supported.`,
      { contentTypeId: id },
    );
  }

  // Substituted with a non-empty token rather than removed, so a template whose
  // segments are placeholders (`/{locale}/articles/{slug}`) is not mistaken for
  // one with an empty segment.
  const structural = template
    .split(CONTENT_SEARCH_SLUG_PLACEHOLDER)
    .join("x")
    .split(CONTENT_SEARCH_LOCALE_PLACEHOLDER)
    .join("x");

  if (
    structural.includes("//") ||
    template.includes("..") ||
    /\s/.test(template)
  ) {
    throw new ContentEngineError(
      `search.pathTemplate "${template}" must not contain an empty segment, "..", or whitespace.`,
      { contentTypeId: id },
    );
  }
};

export const resolveSearch = (
  id: string,
  fields: ContentFieldMap,
  search: ContentSearchConfig | undefined,
  publicApi: ResolvedContentPublicApiConfig,
  publication: boolean,
  localized: boolean,
): ResolvedContentSearchConfig => {
  if (!search?.enabled) return disabledSearch;

  if (!publication) {
    throw new ContentEngineError(
      "search needs `publication: { enabled: true }`. Only published records are indexed, and the publication lifecycle is what drives synchronization.",
      { contentTypeId: id },
    );
  }

  if (!publicApi.enabled) {
    throw new ContentEngineError(
      "search needs `publicApi: { enabled: true, path, fields }`. A search hit links to a public URL, and every indexed field has to be published already.",
      { contentTypeId: id },
    );
  }

  if (id.length > CONTENT_SEARCH_ITEM_TYPE_MAX_LENGTH) {
    throw new ContentEngineError(
      `Content type id "${id}" is longer than ${CONTENT_SEARCH_ITEM_TYPE_MAX_LENGTH} characters, which is the width of the search index's item type column. Shorten the id or turn search off.`,
      { contentTypeId: id },
    );
  }

  const exposed = new Set(publicApi.fields);

  const { titleField } = search;
  assertSearchField({
    exposed,
    fields,
    id,
    kinds: searchTitleKinds,
    label: "search.titleField",
    name: titleField,
  });

  // A `null` title can never be a result heading, and a record whose title is
  // missing is skipped by the mapper - which shows up as a collection that never
  // reaches full coverage. Rejecting the nullable field is the cheap half of
  // that; a blank value written straight into the database is still possible, so
  // the mapper keeps its own check.
  if (resolveFieldTarget(fields, titleField)?.descriptor.nullable) {
    throw new ContentEngineError(
      `search.titleField names the nullable field "${titleField}". A search result needs a heading, so the title field must not be nullable.`,
      { contentTypeId: id },
    );
  }

  const descriptionField = search.descriptionField ?? null;
  if (descriptionField !== null) {
    assertSearchField({
      exposed,
      fields,
      id,
      kinds: searchDescriptionKinds,
      label: "search.descriptionField",
      name: descriptionField,
    });
  }

  // `Array.isArray` rather than a cast: a JavaScript caller can put anything
  // here, and a `.map` on a bare string would be a TypeError instead of the
  // error message below.
  const contentFields = Array.isArray(search.contentFields)
    ? [...search.contentFields]
    : [];
  if (contentFields.length === 0) {
    throw new ContentEngineError(
      "search.contentFields is empty. List at least one field to index - a document with only a title matches almost nothing.",
      { contentTypeId: id },
    );
  }

  const duplicate = contentFields.find(
    (name, position) => contentFields.indexOf(name) !== position,
  );
  if (duplicate !== undefined) {
    throw new ContentEngineError(
      `search.contentFields lists "${duplicate}" twice.`,
      { contentTypeId: id },
    );
  }

  for (const name of contentFields) {
    assertSearchField({
      // The body is the one slot a repeatable leaf can fill: `faq.answer` is
      // many values, and many values concatenated in position order is exactly
      // what a searchable body is made of.
      allowRepeatable: true,
      exposed,
      fields,
      id,
      kinds: searchTextKinds,
      label: "search.contentFields",
      name,
    });
  }

  assertSearchPathTemplate(id, search.pathTemplate, localized);

  return {
    contentFields,
    descriptionField,
    enabled: true,
    pathTemplate: search.pathTemplate,
    titleField,
  };
};
