import type {
  ContentFieldMap,
  ContentProfileContentInput,
  ResolvedContentProfileContentConfig,
  ResolvedContentPublicApiConfig,
  ResolvedContentPublicWriteConfig,
  ResolvedContentSearchConfig,
} from "./types";

import { ContentEngineError } from "./errors";
import { partitionContentFields } from "./localization";

const DISABLED: ResolvedContentProfileContentConfig = {
  authorField: null,
  enabled: false,
  label: null,
};

const OPTION_KEYS = new Set(["label"]);

/** `content.topic.profile_label` - dot-separated segments, no namespace. */
const LABEL_PATTERN = /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/;

/**
 * Resolves `profileContent`: which records count on their authors' profiles.
 *
 * A listed record has to be something a guest can open and credit to a
 * member, so the option needs publication, a public API, a search mapping
 * (its title, snippet and URL template build the profile card - a search
 * *provider* is not needed) and a shared `field.user()` author.
 */
export const resolveProfileContent = (
  id: string,
  profileContent: ContentProfileContentInput | undefined,
  {
    fields,
    publicApi,
    publicWrite,
    publication,
    search,
  }: {
    fields: ContentFieldMap;
    publicApi: ResolvedContentPublicApiConfig;
    publication: boolean;
    publicWrite: ResolvedContentPublicWriteConfig;
    search: ResolvedContentSearchConfig;
  },
): ResolvedContentProfileContentConfig => {
  if (profileContent === undefined || profileContent === false) return DISABLED;

  if (
    profileContent !== true &&
    (typeof profileContent !== "object" || profileContent === null)
  ) {
    throw new ContentEngineError(
      "profileContent is `true` or an options object with `label`.",
      { contentTypeId: id },
    );
  }

  const options = profileContent === true ? {} : profileContent;
  const unknownKey = Object.keys(options).find(key => !OPTION_KEYS.has(key));
  if (unknownKey) {
    throw new ContentEngineError(
      `profileContent.${unknownKey} is not an option. Use \`label\`.`,
      { contentTypeId: id },
    );
  }

  const label = options.label ?? null;
  if (
    label !== null &&
    (typeof label !== "string" || !LABEL_PATTERN.test(label))
  ) {
    throw new ContentEngineError(
      "profileContent.label is an i18n key relative to the plugin's namespace, e.g. `content.topic.profile_label`.",
      { contentTypeId: id },
    );
  }

  if (!publication || !publicApi.enabled) {
    throw new ContentEngineError(
      "profileContent needs `publication` and `publicApi`. A profile lists only what a guest can open.",
      { contentTypeId: id },
    );
  }

  if (!search.enabled || search.pathTemplate === "") {
    throw new ContentEngineError(
      "profileContent needs `search` with a `pathTemplate`. Its title, snippet and URL build the profile card - no search provider is required.",
      { contentTypeId: id },
    );
  }

  const authorField = search.authorField ?? publicWrite.ownerField;
  const descriptor = authorField === null ? undefined : fields[authorField];
  const { localizedFields } = partitionContentFields(fields);
  if (
    authorField === null ||
    descriptor?.kind !== "user" ||
    localizedFields[authorField] !== undefined
  ) {
    throw new ContentEngineError(
      "profileContent needs an author: a shared `field.user()` named by `search.authorField` or `publicWrite.ownership.field`.",
      { contentTypeId: id },
    );
  }

  return { authorField, enabled: true, label };
};
