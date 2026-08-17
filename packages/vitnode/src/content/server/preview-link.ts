import type { Context } from "hono";

import { HTTPException } from "hono/http-exception";

import type { AnyContentTypeDefinition } from "../types";

import { CONFIG } from "../../lib/config";
import {
  CONTENT_PREVIEW_QUERY_PARAM,
  CONTENT_PREVIEW_TOKEN_PLACEHOLDER,
} from "../const";
import { contentDeliveryPath } from "../delivery";
import { contentPreviewConfigProblems } from "./preview-config";
import { ensureContentPreviewSecret } from "./preview-secret";

/**
 * The key this install signs preview links with.
 *
 * Read from the boot config when the global middleware has resolved it, and
 * resolved on the spot otherwise - which is what a direct `app.request()` in a
 * test does, since it never runs the middleware that populates `core`. Both
 * paths land on the same memoised value.
 */
export const contentPreviewSecret = async (c: Context): Promise<string> =>
  c.get("core")?.contentPreviewSecret ??
  (await ensureContentPreviewSecret(c.get("db")));

/**
 * Refuses to mint a link that would not be a link.
 *
 * 503 rather than 500: the request was fine and the code is fine, the deployment
 * has an origin it cannot parse - and a service that is temporarily not offering
 * a feature is what 503 means. The message names the environment variable,
 * because the person clicking the button is usually the person who can set it.
 */
export const assertContentPreviewIsServable = (): void => {
  const problems = contentPreviewConfigProblems();
  if (problems.length === 0) return;

  throw new HTTPException(503, {
    message: `Preview is unavailable: ${problems.join(" ")}`,
  });
};

/**
 * Where a preview link points, as something a person can paste into a browser.
 *
 * Three branches, in order, and the order is the point - a reviewer should land
 * on a **page**, and the JSON endpoint is what is left when there is no page to
 * land on:
 *
 * 1. **`editorial.preview.pathTemplate`** - a page written specifically to render
 *    previews. An explicit answer always wins.
 * 2. **The record's own canonical page**, carrying `?preview=<token>`. A content
 *    type with `delivery` already has a public URL per record, and the page that
 *    renders the published record is the right place to render the draft: the
 *    reviewer sees the real layout rather than a preview-shaped copy of it, and
 *    nobody has to write a second page to get there.
 * 3. **The generated JSON endpoint**, for a content type with no delivery layer
 *    and no preview page. Honest rather than helpful: there is no page to link at.
 *
 * Absolute in every branch, and branches 1 and 2 resolve against a **different
 * origin** from branch 3, because they are served by different processes. A page
 * lives in the web app and the endpoint on the API; assuming those share a host
 * is exactly the assumption a split deployment breaks, and a relative path would
 * resolve against whichever one the AdminCP happened to be on.
 *
 * `split`/`join` rather than `String.replace`, so a `$` in the encoded token
 * cannot be read as a replacement pattern. `defineContentType` has already proven
 * the template holds exactly one `{token}`.
 *
 * `locale` is a query parameter rather than a second placeholder, and both halves
 * of the system read it from there: the generated public preview route resolves
 * its locale exactly the way every other public read does, and a preview page
 * passes the same value to `contentPreviewFetch`. It is omitted on the canonical
 * page, which already carries the language in its path - a localized delivery URL
 * is `/{locale}/...` by construction, so the page reads its own route parameter.
 */
export const contentPreviewUrl = ({
  definition,
  locale,
  pluginId,
  slug,
  token,
}: {
  definition: AnyContentTypeDefinition;
  /** The language the link previews, for a localized content type. */
  locale?: string;
  pluginId: string;
  /**
   * The record's public slug, which is what turns a preview into a link to the
   * record's own page.
   *
   * Absent - or empty, for a row written straight into the database - falls
   * through to the JSON endpoint rather than linking at a list page.
   */
  slug?: null | string;
  token: string;
}): string => {
  const template = definition.editorial.preview.pathTemplate;

  if (template) {
    const url = new URL(
      template
        .split(CONTENT_PREVIEW_TOKEN_PLACEHOLDER)
        .join(encodeURIComponent(token)),
      CONFIG.web,
    );
    if (locale !== undefined && locale !== "") {
      url.searchParams.set("locale", locale);
    }

    return url.toString();
  }

  const canonical =
    definition.delivery.enabled && slug !== undefined && slug !== null
      ? contentDeliveryPath({ definition, locale, slug })
      : null;

  if (canonical !== null) {
    const url = new URL(canonical, CONFIG.web);
    // `set` rather than string concatenation: the token is base64url plus a dot,
    // and letting `URLSearchParams` encode it is what keeps that true.
    url.searchParams.set(CONTENT_PREVIEW_QUERY_PARAM, token);

    return url.toString();
  }

  const url = new URL(
    `/api/${pluginId}/content/${definition.publicApi.path}/preview/${encodeURIComponent(token)}`,
    CONFIG.api,
  );

  if (locale !== undefined && locale !== "") {
    url.searchParams.set("locale", locale);
  }

  return url.toString();
};
