import type { Context } from "hono";

import { HTTPException } from "hono/http-exception";

import type { AnyContentTypeDefinition } from "../types";

import { CONFIG } from "../../lib/config";
import { CONTENT_PREVIEW_TOKEN_PLACEHOLDER } from "../const";
import { contentPreviewConfigProblems } from "./preview-config";

/**
 * The secret from the boot config, falling back to the env getter.
 *
 * The fallback matters for a direct `app.request()` in a test, which does not go
 * through the global middleware that populates `core`.
 */
export const contentPreviewSecret = (c: Context): string =>
  c.get("core")?.contentPreviewSecret ?? CONFIG.contentPreviewSecret;

/**
 * Refuses to mint a link the install cannot protect.
 *
 * 503 rather than 500: the request was fine and the code is fine, the deployment
 * is missing a secret - and a service that is temporarily not offering a feature
 * is what 503 means. The message names the environment variable, because the
 * person clicking the button is usually the person who can set it.
 */
export const assertContentPreviewIsServable = (c: Context): void => {
  const problems = contentPreviewConfigProblems(
    c.get("core")?.contentPreviewSecret ?? process.env.CONTENT_PREVIEW_SECRET,
  );
  if (problems.length === 0) return;

  throw new HTTPException(503, {
    message: `Preview is unavailable: ${problems.join(" ")}`,
  });
};

/**
 * Where a preview link points, as something a person can paste into a browser.
 *
 * Absolute in both branches, and against **different origins**, because they are
 * served by different processes: a `pathTemplate` names a page in the web app,
 * and the generated JSON endpoint lives on the API. Assuming those share a host
 * is exactly the assumption a split deployment breaks, and a relative path would
 * resolve against whichever one the AdminCP happened to be on.
 *
 * `split`/`join` rather than `String.replace`, so a `$` in the encoded token
 * cannot be read as a replacement pattern. `defineContentType` has already proven
 * the template holds exactly one `{token}`.
 *
 * `locale` is appended as a query parameter rather than baked into the template,
 * and both halves of the system read it from there: the generated public preview
 * route resolves its locale exactly the way every other public read does, and a
 * web page passes the same value to `contentPreviewFetch`. A second placeholder
 * would have made every existing `pathTemplate` wrong the day localization
 * landed - and a locale that is only in the path could not be honoured by the API
 * form of the link at all.
 */
export const contentPreviewUrl = ({
  definition,
  locale,
  pluginId,
  token,
}: {
  definition: AnyContentTypeDefinition;
  /** The language the link previews, for a localized content type. */
  locale?: string;
  pluginId: string;
  token: string;
}): string => {
  const encoded = encodeURIComponent(token);
  const template = definition.editorial.preview.pathTemplate;

  const url = template
    ? new URL(
        template.split(CONTENT_PREVIEW_TOKEN_PLACEHOLDER).join(encoded),
        CONFIG.web,
      )
    : new URL(
        `/api/${pluginId}/content/${definition.publicApi.path}/preview/${encoded}`,
        CONFIG.api,
      );

  if (locale !== undefined && locale !== "") {
    url.searchParams.set("locale", locale);
  }

  return url.toString();
};
