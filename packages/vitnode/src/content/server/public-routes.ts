import type {
  PgColumn,
  PgTable,
  PgTableWithColumns,
  TableConfig,
} from "drizzle-orm/pg-core";
import type { Context } from "hono";

import { z } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import type {
  AnyContentTypeDefinition,
  ContentPublicFilterInput,
  ContentPublicOrderableFieldName,
} from "../types";
import type { ContentModel } from "./model";
import type { ContentPreviewTokenPayload } from "./preview-token";
import type { ContentPublicService } from "./public-service";

import { buildRoute } from "../../api/lib/route";
import {
  zodPaginationPageInfo,
  zodPaginationQuery,
} from "../../api/lib/with-pagination";
import { contentTypeName } from "../admin/labels";
import {
  CONTENT_LOCALE_MAX_LENGTH,
  CONTENT_PUBLIC_MAX_PAGE_SIZE,
} from "../const";
import { ContentEngineError } from "../errors";
import { resolveContentPublicLocale } from "../locale";
import { partitionContentFields } from "../localization";
import {
  contentColumnsToValues,
  contentStorageColumns,
  splitContentFieldPath,
} from "../paths";
import { publicOrderableColumns } from "../registry";
import { buildContentDeliveryRoutes } from "./delivery-routes";
import { resolveContentPublicRowFiles } from "./files";
import { findContentLanguage, listContentLanguages } from "./language-resolver";
import { contentPreviewSecret } from "./preview-link";
import { verifyContentPreviewToken } from "./preview-token";
import {
  contentPublicSelection,
  createContentPublicProjector,
} from "./public-service";
import {
  contentSnapshotRow,
  projectTranslationRevisionSnapshot,
} from "./revision-snapshot";

/**
 * The read-only routes one public content type gets.
 *
 * ```http
 * GET /api/{pluginId}/content/{publicApi.path}/
 * GET /api/{pluginId}/content/{publicApi.path}/{slug}
 * GET /api/{pluginId}/content/{publicApi.path}/preview/{token}   (editorial.preview)
 * ```
 *
 * No `adminStaffPermission` and no `/admin/` anywhere in the path, which is
 * exactly how every other public route in VitNode is public: by omission. The
 * global middleware still runs, so `c.get("user")` is populated (possibly
 * `null`) and the IP rate limiter still applies.
 *
 * Only `get` is ever built here. There is no public create, update, delete,
 * publish or unpublish, and no flag that would add one.
 */
export const buildContentPublicRoutes = <
  TDefinition extends AnyContentTypeDefinition,
  P extends string,
>(
  model: ContentModel<TDefinition>,
  { pluginId }: { pluginId: P },
) => {
  const { definition, schemas } = model;
  const name = contentTypeName(definition.id);

  const service = (c: Context): ContentPublicService<TDefinition> => {
    const build = model.publicService;
    if (!build) {
      throw new ContentEngineError(
        "This content type has no public API, so it should not have a public route either.",
        { contentTypeId: definition.id },
      );
    }

    return build(c);
  };

  const localized = definition.localization.enabled;

  // `orderBy` is a literal enum, so a column outside the public allowlist is a
  // 400 at validation time and shows up in the OpenAPI document. The service
  // keeps its own allowlist check for callers that did not come through here.
  const orderable = publicOrderableColumns(definition) as [string, ...string[]];
  const localeQuery = localized
    ? {
        // Loose on purpose, like `publicParams.slug`: an unknown locale and a
        // malformed one are both the same 404, so a stricter pattern here would
        // only turn one of them into a differently-shaped 400 that says more.
        locale: z.string().min(1).max(CONTENT_LOCALE_MAX_LENGTH).optional(),
      }
    : {};
  const paginationQuery = zodPaginationQuery.extend({
    ...localeQuery,
    order: z.enum(["asc", "desc"]).optional(),
    orderBy: z.enum(orderable).optional(),
    search: z.string().optional(),
  });
  const listQuery = paginationQuery.extend(schemas.publicFilters.shape);
  const localeOnlyQuery = z.object(localeQuery);

  const notFound = () =>
    new HTTPException(404, {
      message: `${name} not found.`,
    });

  const project = createContentPublicProjector(definition);

  /**
   * Which language this request is for, or `null`.
   *
   * `null` is a 404, always. An explicit `?locale=xx` that names no language this
   * install serves is a request for something that does not exist - substituting
   * the default would answer a Polish URL with English content and then cache it
   * under the Polish tag, which is the one failure locale-aware caching is here to
   * prevent.
   *
   * A *negotiated* locale is a preference rather than an instruction, so an
   * unmatched `Accept-Language` falls through to the default inside
   * {@link resolveContentPublicLocale} and never reaches this as a `null`.
   */
  const localeFor = async (c: Context) => {
    if (!localized) return { locale: undefined, source: "default" as const };

    const languages = await listContentLanguages(c);

    return resolveContentPublicLocale({
      acceptLanguage: c.req.header("accept-language"),
      // Only the locales this install actually serves. A disabled language is
      // readable in the AdminCP and unreachable in public, which is the read-side
      // half of the rule that already stops content being written into one.
      available: languages
        .filter(language => language.isEnabled)
        .map(language => language.locale),
      defaultLocale: definition.localization.defaultLocale,
      explicit: c.req.query("locale"),
    });
  };

  /**
   * The response headers a localized read carries.
   *
   * `Content-Language` is the resolved locale, which with a fallback is not always
   * the one that was asked for. `Vary: Accept-Language` is added only when the
   * locale actually came from the header - a response chosen by an explicit
   * `?locale=` is keyed by its URL, and varying on a header that did not decide
   * anything would fragment every shared cache for nothing.
   */
  const localeHeaders = (
    locale: string | undefined,
    source: "default" | "explicit" | "negotiated",
  ): Record<string, string> => {
    if (locale === undefined) return {};

    return {
      "Content-Language": locale,
      ...(source === "negotiated" ? { Vary: "Accept-Language" } : {}),
    };
  };

  // Widened, not cast: the generated table type carries every column as a
  // literal, which Drizzle's `.from()` overloads cannot resolve through a
  // generic. This is the same parameter type `createContentPublicService`
  // declares, so the assignment is checked rather than asserted.
  const table: PgTableWithColumns<TableConfig> = model.table;
  /** The same widening, for the translation half of a localized preview. */
  const translationTable: null | PgTable = model.translationTable;

  /**
   * The row a preview link points at.
   *
   * Normally the revision's frozen snapshot, so a reviewer sees what the editor
   * was looking at when they shared the link rather than whatever the record
   * has drifted to since.
   *
   * `r === 0` is the one case that reads live: a record that predates its
   * content type opting into `editorial` has no revision to freeze. It is still
   * scoped to the id inside the signed token, and still projected through the
   * public allowlist - only the "frozen" guarantee is unavailable, because
   * there is nothing to freeze.
   */
  const readPreviewRow = async (
    c: Context,
    payload: ContentPreviewTokenPayload,
  ): Promise<null | Record<string, unknown>> => {
    if (payload.r > 0) {
      const build = model.editorialService;
      if (!build) return null;

      // Scoped by the record id from the token as well as the revision id: the
      // revisions table is shared, so an id alone proves nothing about
      // ownership - and the token's own id is the one this route trusts.
      const revision = await build(c, { pluginId }).revisions.findById(
        payload.i,
        payload.r,
      );

      return revision ? contentSnapshotRow(revision.snapshot) : null;
    }

    // Deliberately no published predicate - previewing a draft is the whole
    // feature - but still only the allowlisted columns, so a private one is
    // never fetched in the first place.
    const [row] = await c
      .get("db")
      .select(contentPublicSelection(definition, model.columns))
      .from(table)
      .where(eq(model.columns.id, payload.i))
      .limit(1);

    return row ?? null;
  };

  /**
   * The localized half of a preview: one language's field values.
   *
   * The language is resolved from the token's `l` - the locale **string** - and
   * never from its `lid`. The id is carried so a reader that already trusts it can
   * skip a lookup, but a signed token outlives the row it names: a language can be
   * deleted and its id reused, and resolving the code through the registry is one
   * query that cannot go stale in that direction.
   *
   * `tr === 0` reads live for the same reason `r === 0` does, and loses exactly
   * the same guarantee: there is no translation revision to freeze.
   */
  const readPreviewTranslation = async (
    c: Context,
    payload: ContentPreviewTokenPayload,
  ): Promise<null | Record<string, unknown>> => {
    const locale = payload.l;
    if (locale === undefined) return null;

    const language = await findContentLanguage(c, locale);
    if (!language) return null;

    const translationColumns: null | Record<string, PgColumn> =
      model.translationColumns;
    if (!translationColumns || !translationTable) return null;

    if (payload.tr && payload.tr > 0) {
      const build = model.translationEditorialService;
      if (!build) return null;

      const revision = await build(c, { pluginId }).findRevision(
        payload.i,
        language.locale,
        payload.tr,
      );

      // `projectTranslationRevisionSnapshot`, not the whole snapshot row: the
      // localized *values* and nothing else. A translation snapshot also carries
      // its own `createdAt`, `version` and publication state, and letting those
      // through would overwrite the record's with the translation's.
      return revision
        ? projectTranslationRevisionSnapshot(definition, revision.snapshot)
        : null;
    }

    const { localizedFields } = partitionContentFields(definition.fields);
    // Classified by the **owner** of each exposed name, so a leaf of a localized
    // group is read from the translation exactly as the field it belongs to is.
    // A top-level lookup would find neither `seo.title` nor `seo.description`
    // and silently preview a draft without its SEO - while the *revision* path
    // above, which projects a snapshot, would include them.
    const exposedLocalized = definition.publicApi.fields.filter(name => {
      const path = splitContentFieldPath(name);

      return localizedFields[path ? path[0] : name] !== undefined;
    });
    const localizedColumns = contentStorageColumns(
      Object.fromEntries(
        [
          ...new Set(
            exposedLocalized.map(
              name => splitContentFieldPath(name)?.[0] ?? name,
            ),
          ),
        ].map(name => [name, localizedFields[name]]),
      ),
    );

    const [row] = await c
      .get("db")
      .select(
        Object.fromEntries(
          Object.keys(localizedColumns).map(name => [
            name,
            translationColumns[name],
          ]),
        ),
      )
      .from(translationTable)
      .where(
        and(
          eq(translationColumns.itemId, payload.i),
          eq(translationColumns.languageId, language.id),
        ),
      )
      .limit(1);

    // Folded back into the nested logical shape, so the projector - which reads
    // a group by its own name - sees the same thing a live public read gives it.
    return row
      ? { ...row, ...contentColumnsToValues(localizedFields, row) }
      : null;
  };

  const list = buildRoute({
    pluginId,
    route: {
      method: "get",
      path: "/",
      description: `List published ${name} records`,
      request: { query: listQuery },
      responses: {
        200: {
          content: {
            "application/json": {
              schema: z.object({
                edges: z.array(schemas.publicSelectObject),
                pageInfo: zodPaginationPageInfo,
              }),
            },
          },
          description: `Up to ${CONTENT_PUBLIC_MAX_PAGE_SIZE} published ${name} records`,
        },
        400: { description: "Invalid query parameters" },
      },
    },
    handler: async c => {
      // The whole query string goes through both schemas, each reading only the
      // keys it owns, and neither is strict - so a stale bookmark or a tracking
      // parameter is ignored rather than turned into a 400. `orderBy` is the
      // exception: a *present* but unknown column fails validation.
      const raw = c.req.query();
      const { cursor, first, last, order, orderBy, search } =
        paginationQuery.parse(raw);
      const filters = schemas.publicFilters.parse(
        raw,
      ) as ContentPublicFilterInput<TDefinition>;

      // An explicit locale naming no language this install serves is the same
      // 404 the detail route answers, not an empty list: an empty list would say
      // "this language has no articles", which is a different and untrue thing.
      const resolved = await localeFor(c);
      if (!resolved) throw notFound();

      const data = await service(c).findMany({
        filters,
        locale: resolved.locale,
        // Both narrowings restate what the schemas just proved: `orderBy` came
        // out of a literal enum built from `publicApi.orderableFields`, and
        // `filters` out of a shape built from `publicApi.filterableFields`. The
        // service re-checks both, since the type is not what protects the query.
        orderBy: {
          column: orderBy as ContentPublicOrderableFieldName<TDefinition>,
          order,
        },
        query: { cursor, first, last, search },
      });

      return c.json(data, 200, localeHeaders(resolved.locale, resolved.source));
    },
  });

  /**
   * The one public route that can return an unpublished record.
   *
   * Everything that makes that safe is in this handler, so it is worth reading
   * as a whole:
   *
   * - **The token is the authorization.** Signed with HMAC-SHA256, bound to one
   *   plugin, one content type, one record and one revision, and expiring. No
   *   session is consulted, which is the point - a reviewer has no account.
   * - **Every failure is the same 404.** A forged signature, an expired link, a
   *   token for another record and a record that never existed are
   *   indistinguishable. A 401 or a 403 would confirm the record exists, which
   *   is precisely what a draft URL must not do.
   * - **The projection is the public one.** `createContentPublicProjector` is
   *   the same function the detail route uses, so a private field cannot be
   *   public here and private there.
   * - **Nothing caches it.** `private, no-store` keeps it out of shared caches
   *   and `noindex, nofollow` keeps it out of search results, in case a link is
   *   pasted somewhere public.
   * - **A localized preview is bound to its language.** The locale this request
   *   resolved to is handed to `verifyContentPreviewToken`, which compares it with
   *   the token's own and refuses a mismatch in either direction. A `pl` link
   *   opened on the English URL is the same 404 as a forged one - falling back
   *   would hand a reviewer a different language from the one they were sent.
   */
  const preview = buildRoute({
    pluginId,
    route: {
      method: "get",
      // Two segments, so it can never shadow `/{slug}` - a record whose slug is
      // literally "preview" still resolves the ordinary way.
      path: "/preview/{token}",
      description: `Read one ${name} from a signed preview link`,
      request: {
        params: z.object({ token: z.string() }),
        ...(localized ? { query: localeOnlyQuery } : {}),
      },
      responses: {
        200: {
          content: {
            "application/json": { schema: schemas.publicSelectObject },
          },
          description: `${name} as the link's revision recorded it`,
        },
        404: { description: "No such preview" },
      },
    },
    handler: async c => {
      const secret = await contentPreviewSecret(c);

      const resolved = await localeFor(c);
      if (!resolved) throw notFound();

      const payload = verifyContentPreviewToken({
        definition,
        locale: resolved.locale,
        pluginId,
        secret,
        token: c.req.param("token"),
      });
      if (!payload) throw notFound();

      const row = await readPreviewRow(c, payload);
      if (!row) throw notFound();

      // Both halves, or nothing. A localized preview promises the page as it
      // stood, and a page is a record plus a translation - serving the shared
      // half with the localized fields missing would be a different page.
      const translated = localized
        ? await readPreviewTranslation(c, payload)
        : null;
      if (localized && !translated) throw notFound();

      // The same file resolution the published reads do, through the same
      // function: a preview that showed a bare `core_files.id` where the live
      // page shows a descriptor would be previewing a different response.
      const [withFiles] = await resolveContentPublicRowFiles(c, definition, [
        { ...row, ...translated },
      ]);

      return c.json(
        {
          ...project(withFiles),
          ...(localized ? { locale: resolved.locale } : {}),
        },
        200,
        {
          "Cache-Control": "private, no-store",
          "X-Robots-Tag": "noindex, nofollow",
          ...localeHeaders(resolved.locale, resolved.source),
        },
      );
    },
  });

  const detail = buildRoute({
    pluginId,
    route: {
      method: "get",
      path: "/{slug}",
      description: `Get one published ${name} by slug`,
      request: {
        params: schemas.publicParams,
        ...(localized ? { query: localeOnlyQuery } : {}),
      },
      responses: {
        200: {
          content: {
            "application/json": { schema: schemas.publicSelectObject },
          },
          description: `${name} found`,
        },
        404: { description: `${name} not found` },
      },
    },
    handler: async c => {
      const resolved = await localeFor(c);
      if (!resolved) throw notFound();

      // A draft, an unpublished row, a cleared publication date, a translation
      // that is not published in this language and a typo are all the same 404.
      // A 403 would confirm the record exists, which is the one thing a draft
      // URL must not do - and so would a 404 that only some of them produced.
      //
      // Strict-locale by construction: `findBySlug` does not fall back, so this
      // never answers a Polish URL with the English article.
      const row = await service(c).findBySlug(c.req.param("slug"), {
        locale: resolved.locale,
      });
      if (!row) throw notFound();

      return c.json(row, 200, localeHeaders(resolved.locale, resolved.source));
    },
  });

  return [
    list,
    // Before `detail` for readability only - the two can never both match, so
    // the order carries no meaning. The delivery routes are the same: every one of
    // them begins with a static `delivery` segment and `/{slug}` is a single
    // segment, so a record whose slug is literally "delivery" still resolves.
    ...(definition.editorial.preview.enabled ? [preview] : []),
    ...(definition.delivery.enabled
      ? buildContentDeliveryRoutes(model, { pluginId })
      : []),
    detail,
  ];
};
