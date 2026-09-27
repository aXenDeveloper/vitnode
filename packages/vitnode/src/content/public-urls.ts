import { CONTENT_SEARCH_SLUG_PLACEHOLDER } from "./const";

export const CONTENT_URLS_ERROR_PREFIX = "[VitNode content URLs]";

export const CONTENT_TYPES_EXPORT = "contentTypes";

export type ContentUrlErrorCode =
  | "content-module-not-exported"
  | "content-url-without-page"
  | "incomplete-content-types"
  | "invalid-content-types-module"
  | "undeclared-content-types";

export type ContentUrlSetting = "delivery.path" | "search.pathTemplate";

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
  delivery: { enabled: boolean; path: string };
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

const CONTENT_MODULE_HINT =
  "Export every content type with public URLs from the plugin's browser-safe `src/content.ts` as `export const contentTypes = [...]`, list `./content` in its package.json exports (the `./*` wildcard covers it), and pass that same array to `buildApiPlugin({ contentTypes })`. The web build reads the module to check that a page serves each URL.";

export const assertContentTypesDeclared = ({
  declared,
  pluginId,
  published,
}: {
  declared: readonly ContentUrlDefinition[] | undefined;
  pluginId: string;
  published: readonly ContentUrlDefinition[];
}): void => {
  const publishing = published.filter(
    definition => contentPublicUrls(definition).length > 0,
  );
  const [first] = publishing;
  if (first === undefined) return;

  if (declared === undefined) {
    throw new ContentUrlError(
      `${CONTENT_URLS_ERROR_PREFIX} Plugin "${pluginId}" registers content types with public URLs (${publishing.map(definition => `"${definition.id}": ${describeUrls(definition)}`).join("; ")}), but does not declare its content module, so no build can check that a page serves those URLs. ${CONTENT_MODULE_HINT}`,
      {
        code: "undeclared-content-types",
        contentTypeId: first.id,
        pluginId,
      },
    );
  }

  for (const definition of publishing) {
    const match = declared.find(candidate => candidate.id === definition.id);
    if (match && sameUrls(match, definition)) continue;

    throw new ContentUrlError(
      match
        ? `${CONTENT_URLS_ERROR_PREFIX} Plugin "${pluginId}" registers content type "${definition.id}" with ${describeUrls(definition)}, but its declared content module lists it with ${describeUrls(match) || "no public URLs"}. Pass the same definitions to both - import \`contentTypes\` from \`src/content.ts\` instead of building a second list.`
        : `${CONTENT_URLS_ERROR_PREFIX} Plugin "${pluginId}" registers content type "${definition.id}" with ${describeUrls(definition)}, but the \`contentTypes\` it passes to \`buildApiPlugin\` do not include it, so no build checks that a page serves those URLs. Add "${definition.id}" to \`contentTypes\` in the plugin's \`src/content.ts\`.`,
      {
        code: "incomplete-content-types",
        contentTypeId: definition.id,
        pluginId,
      },
    );
  }
};
