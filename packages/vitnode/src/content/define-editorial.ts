import type {
  ContentEditorialConfig,
  ResolvedContentEditorialConfig,
  ResolvedContentPublicApiConfig,
} from "./types";

import {
  CONTENT_PREVIEW_DEFAULT_TTL_MINUTES,
  CONTENT_PREVIEW_MAX_TTL_MINUTES,
  CONTENT_PREVIEW_MIN_TTL_MINUTES,
  CONTENT_PREVIEW_PATH_MAX_LENGTH,
  CONTENT_PREVIEW_TOKEN_PLACEHOLDER,
  CONTENT_REVISION_DEFAULT_RETENTION,
  CONTENT_REVISION_MAX_RETENTION,
  CONTENT_REVISION_MIN_RETENTION,
  CONTENT_SEARCH_ITEM_TYPE_MAX_LENGTH,
} from "./const";
import { ContentEngineError } from "./errors";

const disabledEditorial: ResolvedContentEditorialConfig = {
  enabled: false,
  preview: {
    enabled: false,
    expiresInMinutes: CONTENT_PREVIEW_DEFAULT_TTL_MINUTES,
    pathTemplate: null,
  },
  revisions: { retention: CONTENT_REVISION_DEFAULT_RETENTION },
  scheduling: { enabled: false },
};

const assertPreviewPathTemplate = (id: string, template: string): void => {
  if (!template.startsWith("/")) {
    throw new ContentEngineError(
      `editorial.preview.pathTemplate "${template}" must start with "/". A preview URL is relative to the site root.`,
      { contentTypeId: id },
    );
  }

  if (template.length > CONTENT_PREVIEW_PATH_MAX_LENGTH) {
    throw new ContentEngineError(
      `editorial.preview.pathTemplate "${template}" is longer than ${CONTENT_PREVIEW_PATH_MAX_LENGTH} characters.`,
      { contentTypeId: id },
    );
  }

  const occurrences =
    template.split(CONTENT_PREVIEW_TOKEN_PLACEHOLDER).length - 1;
  if (occurrences !== 1) {
    throw new ContentEngineError(
      `editorial.preview.pathTemplate "${template}" must contain exactly one "${CONTENT_PREVIEW_TOKEN_PLACEHOLDER}" placeholder, not ${occurrences}.`,
      { contentTypeId: id },
    );
  }

  const rest = template.replace(CONTENT_PREVIEW_TOKEN_PLACEHOLDER, "");
  if (rest.includes("{") || rest.includes("}")) {
    throw new ContentEngineError(
      `editorial.preview.pathTemplate "${template}" uses a placeholder other than "${CONTENT_PREVIEW_TOKEN_PLACEHOLDER}". No other placeholder is supported.`,
      { contentTypeId: id },
    );
  }

  if (rest.includes("//") || template.includes("..") || /\s/.test(template)) {
    throw new ContentEngineError(
      `editorial.preview.pathTemplate "${template}" must not contain an empty segment, "..", or whitespace.`,
      { contentTypeId: id },
    );
  }
};

const assertInRange = ({
  id,
  label,
  max,
  min,
  value,
}: {
  id: string;
  label: string;
  max: number;
  min: number;
  value: number;
}): void => {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ContentEngineError(
      `${label} must be a whole number between ${min} and ${max}, got ${value}.`,
      { contentTypeId: id },
    );
  }
};

/**
 * Checks and fills in `editorial`.
 *
 * Runs last, because both sub-features are stated in terms of capabilities the
 * other resolvers have already settled. The two dependency checks repeat what
 * the types already say, for the same reason every other one does: a JavaScript
 * caller, or a value that widened somewhere upstream, can reach this with
 * anything at all.
 */
export const resolveEditorial = (
  id: string,
  editorial: ContentEditorialConfig | undefined,
  publicApi: ResolvedContentPublicApiConfig,
  publication: boolean,
): ResolvedContentEditorialConfig => {
  if (!editorial?.enabled) return disabledEditorial;

  const retention =
    editorial.revisions?.retention ?? CONTENT_REVISION_DEFAULT_RETENTION;
  assertInRange({
    id,
    label: "editorial.revisions.retention",
    max: CONTENT_REVISION_MAX_RETENTION,
    min: CONTENT_REVISION_MIN_RETENTION,
    value: retention,
  });

  // A content type id is used verbatim as `core_content_revisions.contentTypeId`,
  // which is varchar(100) - the same limit `search` enforces, and worth
  // catching here rather than at the first insert.
  if (id.length > CONTENT_SEARCH_ITEM_TYPE_MAX_LENGTH) {
    throw new ContentEngineError(
      `Content type id "${id}" is longer than ${CONTENT_SEARCH_ITEM_TYPE_MAX_LENGTH} characters, which is the limit for a revision's stored content type.`,
      { contentTypeId: id },
    );
  }

  const preview =
    editorial.preview?.enabled === true ? editorial.preview : null;
  if (preview && !publicApi.enabled) {
    throw new ContentEngineError(
      "editorial.preview needs `publicApi: { enabled: true, path, fields }`. A preview returns the public projection of a draft, so without a public allowlist there is nothing it could safely show.",
      { contentTypeId: id },
    );
  }

  const expiresInMinutes =
    preview?.expiresInMinutes ?? CONTENT_PREVIEW_DEFAULT_TTL_MINUTES;
  if (preview) {
    assertInRange({
      id,
      label: "editorial.preview.expiresInMinutes",
      max: CONTENT_PREVIEW_MAX_TTL_MINUTES,
      min: CONTENT_PREVIEW_MIN_TTL_MINUTES,
      value: expiresInMinutes,
    });

    if (preview.pathTemplate !== undefined) {
      assertPreviewPathTemplate(id, preview.pathTemplate);
    }
  }

  const scheduling = editorial.scheduling?.enabled === true;
  if (scheduling && !publication) {
    throw new ContentEngineError(
      "editorial.scheduling needs `publication: { enabled: true }`. A schedule moves `status`, and without the lifecycle there is no status to move.",
      { contentTypeId: id },
    );
  }

  return {
    enabled: true,
    preview: {
      enabled: preview !== null,
      expiresInMinutes,
      pathTemplate: preview?.pathTemplate ?? null,
    },
    revisions: { retention },
    scheduling: { enabled: scheduling },
  };
};
