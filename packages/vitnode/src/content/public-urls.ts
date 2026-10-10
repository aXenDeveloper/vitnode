import { CONTENT_SEARCH_SLUG_PLACEHOLDER } from "./const";

export const CONTENT_URLS_ERROR_PREFIX = "[VitNode content URLs]";

export const CONTENT_TYPES_EXPORT = "contentTypes";

export type ContentUrlErrorCode =
  | "content-module-missing"
  | "content-url-without-page"
  | "incomplete-content-types"
  | "invalid-content-types-module";

export type ContentUrlSetting =
  | "delivery.list.path"
  | "delivery.path"
  | "search.pathTemplate";

export interface ContentUrlErrorDetails {
  code: ContentUrlErrorCode;
  contentTypeId?: string;
  pattern?: string;
  pluginId: string;
  setting?: ContentUrlSetting;
}

export class ContentUrlError extends Error {
  constructor(message: string, details: ContentUrlErrorDetails) {
    super(message);
    this.name = "ContentUrlError";
    this.code = details.code;
    this.contentTypeId = details.contentTypeId;
    this.pattern = details.pattern;
    this.pluginId = details.pluginId;
    this.setting = details.setting;
  }

  readonly code: ContentUrlErrorCode;
  readonly contentTypeId?: string;
  readonly pattern?: string;
  readonly pluginId: string;
  readonly setting?: ContentUrlSetting;
}

export interface ContentUrlDefinition {
  delivery: {
    enabled: boolean;
    /** Optional so a definition built before list pages existed still reads. */
    list?: { enabled: boolean; path: string };
    path: string;
  };
  id: string;
  search: { enabled: boolean; pathTemplate: string };
}

export interface ContentPublicUrl {
  declared: string;
  routePath: string;
  setting: ContentUrlSetting;
}

export const contentPublicUrls = (
  definition: ContentUrlDefinition,
): ContentPublicUrl[] => {
  const urls: ContentPublicUrl[] = [];

  if (definition.delivery.enabled && definition.delivery.path !== "") {
    urls.push({
      declared: definition.delivery.path,
      routePath: definition.delivery.path,
      setting: "delivery.path",
    });
  }

  const list = definition.delivery.list;
  if (definition.delivery.enabled && list?.enabled && list.path !== "") {
    urls.push({
      declared: list.path,
      routePath: list.path,
      setting: "delivery.list.path",
    });
  }

  if (definition.search.enabled && definition.search.pathTemplate !== "") {
    urls.push({
      declared: definition.search.pathTemplate,
      routePath: definition.search.pathTemplate.replaceAll(
        CONTENT_SEARCH_SLUG_PLACEHOLDER,
        ":slug",
      ),
      setting: "search.pathTemplate",
    });
  }

  return urls;
};

const describeUrls = (definition: ContentUrlDefinition): string =>
  contentPublicUrls(definition)
    .map(url => `${url.setting} "${url.declared}"`)
    .join(" and ");

const sameUrls = (a: ContentUrlDefinition, b: ContentUrlDefinition): boolean =>
  JSON.stringify(contentPublicUrls(a)) === JSON.stringify(contentPublicUrls(b));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasSetting = (value: unknown, field: "path" | "pathTemplate"): boolean =>
  isRecord(value) &&
  typeof value.enabled === "boolean" &&
  typeof value[field] === "string";

const isContentUrlDefinition = (
  value: unknown,
): value is ContentUrlDefinition =>
  isRecord(value) &&
  typeof value.id === "string" &&
  hasSetting(value.delivery, "path") &&
  hasSetting(value.search, "pathTemplate");

export const contentModuleSpecifier = (pluginId: string): string =>
  `${pluginId}/content`;

export const contentTypesFromContentModule = (
  loaded: unknown,
  pluginId: string,
  specifier: string = contentModuleSpecifier(pluginId),
): ContentUrlDefinition[] => {
  const contentTypes = isRecord(loaded)
    ? loaded[CONTENT_TYPES_EXPORT]
    : undefined;

  if (
    Array.isArray(contentTypes) &&
    contentTypes.every(isContentUrlDefinition)
  ) {
    return contentTypes;
  }

  throw new ContentUrlError(
    `${CONTENT_URLS_ERROR_PREFIX} "${specifier}" must export \`${CONTENT_TYPES_EXPORT}\`: an array of the plugin's content type definitions, each returned by \`defineContentType\` from "@vitnode/core/content". Export it, or remove the "${specifier}" module if the plugin publishes no content URLs.`,
    { code: "invalid-content-types-module", pluginId },
  );
};

export const assertContentModuleCovers = ({
  loaded,
  loadedFrom,
  pluginId,
  published,
}: {
  loaded: unknown;
  loadedFrom: string;
  pluginId: string;
  published: readonly ContentUrlDefinition[];
}): void => {
  const publishing = published.filter(
    definition => contentPublicUrls(definition).length > 0,
  );
  const [first] = publishing;
  if (first === undefined) return;

  const specifier = contentModuleSpecifier(pluginId);

  if (loaded === undefined) {
    throw new ContentUrlError(
      `${CONTENT_URLS_ERROR_PREFIX} Plugin "${pluginId}" registers content types with public URLs (${publishing.map(definition => `"${definition.id}": ${describeUrls(definition)}`).join("; ")}), but "${specifier}" was not found through ${loadedFrom}, so no web build can check that a page serves those URLs. Export them from a browser-safe module as \`export const ${CONTENT_TYPES_EXPORT} = [...]\` and expose it as "./content" in the plugin's package.json exports.`,
      {
        code: "content-module-missing",
        contentTypeId: first.id,
        pluginId,
      },
    );
  }

  const declared = contentTypesFromContentModule(loaded, pluginId, specifier);

  for (const definition of publishing) {
    const match = declared.find(candidate => candidate.id === definition.id);
    if (match && sameUrls(match, definition)) continue;

    throw new ContentUrlError(
      match
        ? `${CONTENT_URLS_ERROR_PREFIX} Plugin "${pluginId}" registers content type "${definition.id}" with ${describeUrls(definition)}, but "${specifier}" exports it with ${describeUrls(match) || "no public URLs"}, so the web build checks the wrong pages. Register the definitions that module exports instead of a second copy.`
        : `${CONTENT_URLS_ERROR_PREFIX} Plugin "${pluginId}" registers content type "${definition.id}" with ${describeUrls(definition)}, but "${specifier}" does not export it, so no web build checks that a page serves those URLs. Add it to \`${CONTENT_TYPES_EXPORT}\` in that module.`,
      {
        code: "incomplete-content-types",
        contentTypeId: definition.id,
        pluginId,
      },
    );
  }
};
