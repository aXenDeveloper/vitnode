import type {
  ContentPublicUrl,
  ContentUrlDefinition,
  ContentUrlSetting,
} from "../../content/public-urls.js";
import type { PluginRoute } from "../../routing/types.js";
import type { HostRoutePath } from "./host-routes.js";

import {
  CONTENT_TYPES_EXPORT,
  CONTENT_URLS_ERROR_PREFIX,
  contentPublicUrls,
  ContentUrlError,
} from "../../content/public-urls.js";
import { parseRoutePath, routeMatchKey } from "../../routing/path.js";
import { localeRoutePathTargets } from "./locale-route-paths.js";

export type {
  ContentUrlDefinition,
  ContentUrlErrorCode,
  ContentUrlErrorDetails,
  ContentUrlSetting,
} from "../../content/public-urls.js";
export {
  CONTENT_TYPES_EXPORT,
  CONTENT_URLS_ERROR_PREFIX,
  ContentUrlError,
} from "../../content/public-urls.js";

export interface ContentUrlSource {
  contentTypes: readonly ContentUrlDefinition[];
  pluginId: string;
  specifier?: string;
}

export interface AssertContentUrlsHavePagesOptions {
  contentUrls: readonly ContentUrlSource[];
  hostRoutes?: readonly HostRoutePath[];
  manifest: readonly PluginRoute[];
}

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

export const contentTypesFromContentModule = (
  loaded: unknown,
  pluginId: string,
  specifier: string,
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

const disableHint: Record<ContentUrlSetting, string> = {
  "delivery.path": "turn delivery off (`delivery: { enabled: false }`)",
  "search.pathTemplate": "turn search off for this content type",
};

const urlWithoutPageError = (
  source: ContentUrlSource,
  definition: ContentUrlDefinition,
  url: ContentPublicUrl,
  reason: string,
): ContentUrlError => {
  const declaredIn =
    source.specifier === undefined ? "" : ` Declared in "${source.specifier}".`;

  return new ContentUrlError(
    `${CONTENT_URLS_ERROR_PREFIX} Plugin "${source.pluginId}" content type "${definition.id}" publishes URLs at "${url.declared}" (${url.setting}), but ${reason}, so its canonical links, sitemap entries and search results would 404. Add a page route at "${url.routePath}" (\`page("${url.routePath}", ...)\` in a plugin's \`src/routes.ts\`, or a route file in the app), point ${url.setting} at a path an existing page serves, or ${disableHint[url.setting]}.${declaredIn}`,
    {
      code: "content-url-without-page",
      contentTypeId: definition.id,
      pattern: url.declared,
      pluginId: source.pluginId,
      setting: url.setting,
    },
  );
};

export const assertContentUrlsHavePages = ({
  contentUrls,
  hostRoutes,
  manifest,
}: AssertContentUrlsHavePagesOptions): void => {
  if (contentUrls.length === 0) return;

  const servedKeys = new Set(
    localeRoutePathTargets({
      hostRoutes,
      isIgnoredPath: () => false,
      manifest,
    }).flatMap(target =>
      target.kind === "layout" ? [] : [routeMatchKey([...target.segments])],
    ),
  );

  for (const source of contentUrls) {
    for (const definition of source.contentTypes) {
      for (const url of contentPublicUrls(definition)) {
        const parsed = parseRoutePath(url.routePath);

        if (!parsed.ok) {
          throw urlWithoutPageError(
            source,
            definition,
            url,
            `no page route can serve it (${parsed.reason})`,
          );
        }

        if (servedKeys.has(routeMatchKey(parsed.segments))) continue;

        throw urlWithoutPageError(
          source,
          definition,
          url,
          "no page route in this app serves that path",
        );
      }
    }
  }
};
