import type { ContentIdStrategy } from "./ids";
import type {
  ContentDuplicationInput,
  ContentFieldMap,
  ResolvedContentAdminConfig,
  ResolvedContentDuplicationConfig,
  ResolvedContentVisibilityConfig,
} from "./types";

import { CONTENT_DEFAULT_ID_STRATEGY, CONTENT_ID_STRATEGIES } from "./const";
import { ContentEngineError } from "./errors";

export const resolveIdStrategy = (
  id: string,
  idStrategy: unknown,
): ContentIdStrategy => {
  if (idStrategy === undefined) return CONTENT_DEFAULT_ID_STRATEGY;

  if (!(CONTENT_ID_STRATEGIES as readonly unknown[]).includes(idStrategy)) {
    throw new ContentEngineError(
      `idStrategy must be one of ${CONTENT_ID_STRATEGIES.map(value => `"${value}"`).join(", ")}, not ${JSON.stringify(idStrategy)}.`,
      { contentTypeId: id },
    );
  }

  return idStrategy as ContentIdStrategy;
};

export const resolveVisibility = (
  id: string,
  visibility: boolean | undefined,
  publication: boolean,
): ResolvedContentVisibilityConfig => {
  if (visibility !== undefined && typeof visibility !== "boolean") {
    throw new ContentEngineError(
      "visibility is `true` or `false`. It has no options of its own.",
      { contentTypeId: id },
    );
  }
  if (visibility !== true) return { enabled: false };

  // Hiding is "unavailable publicly regardless of publication status". Without
  // publication there is no public side to take a record off.
  if (!publication) {
    throw new ContentEngineError(
      "visibility needs `publication: true`. Hiding takes a record off the public site, and a content type without publication has none.",
      { contentTypeId: id },
    );
  }

  return { enabled: true };
};

export const resolveDuplication = (
  id: string,
  duplication: ContentDuplicationInput | undefined,
  fields: ContentFieldMap,
  admin: ResolvedContentAdminConfig,
): ResolvedContentDuplicationConfig => {
  if (duplication === undefined || duplication === false) {
    return { enabled: false, titleSuffixField: null };
  }

  const titleSuffix =
    duplication === true ? undefined : duplication.titleSuffix;

  if (titleSuffix === false) {
    return { enabled: true, titleSuffixField: null };
  }

  const titleField = admin.titleField;
  if (titleField !== null && fields[titleField]?.kind === "text") {
    return { enabled: true, titleSuffixField: titleField };
  }

  if (titleSuffix === true) {
    throw new ContentEngineError(
      `duplication.titleSuffix needs \`admin.titleField\` to be a text field, and "${String(titleField)}" is not one. Drop \`titleSuffix\` or point \`admin.titleField\` at a text field.`,
      { contentTypeId: id },
    );
  }

  return { enabled: true, titleSuffixField: null };
};
