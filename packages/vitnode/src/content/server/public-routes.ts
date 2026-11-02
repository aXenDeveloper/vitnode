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

import type { ContentId, ContentIdOf } from "../ids";
import type {
  AnyContentTypeDefinition,
  ContentPublicFilterInput,
  ContentPublicOrderableFieldName,
} from "../types";
import type { ContentModel } from "./model";
import type { AnyContentModel } from "./model";
import type { ContentPreviewTokenPayload } from "./preview-token";
import type { ContentPublicService } from "./public-service";
import type { ContentThreadNode } from "./thread";

import { setPageCacheTags } from "../../api/lib/page-cache";
import { buildRoute } from "../../api/lib/route";
import {
  zodPaginationPageInfo,
  zodPaginationQuery,
} from "../../api/lib/with-pagination";
import { decideContentAccessForScopes } from "../access/server/decide";
import { contentFileDownloadRoute } from "../access/server/download-route";
import {
  CONTENT_ACCESS_PRIVATE_HEADERS,
  CONTENT_ACCESS_SYSTEM_ACTOR,
  contentAccessMissReason,
  contentAccessPageCacheTags,
  contentAccessRequiredResponse,
  isContentAccessShareable,
  zodContentAccessRequired,
} from "../access/server/http";
import { contentAccessSourceOf } from "../access/server/source";
import { contentTypeName } from "../admin/labels";
import { contentContainerTag } from "../cache";
import {
  CONTENT_HIDDEN_HEADER,
  CONTENT_LOCALE_MAX_LENGTH,
  CONTENT_PUBLIC_MAX_PAGE_SIZE,
} from "../const";
import { contentContainerFieldOf } from "../containers/association";
import { createContentContainerService } from "../containers/server/service";
import { ContentEngineError } from "../errors";
import { parseContentId } from "../ids";
import { CONTENT_THREAD_BRANCHES_MAX } from "../live/refresh";
import { partitionContentFields } from "../localization";
import {
  contentColumnsToValues,
  contentStorageColumns,
  splitContentFieldPath,
} from "../paths";
import { publicOrderableColumns } from "../registry";
import { buildContentDeliveryRoutes } from "./delivery-routes";
import { resolveContentPublicRowFiles } from "./files";
import {
  contentListHiddenAccess,
  contentThreadHiddenAccess,
  findViewableHiddenBySlug,
} from "./hidden-access";
import { findContentLanguage } from "./language-resolver";
import {
  contentListPageCacheTags,
  contentRecordPageCacheTags,
} from "./page-cache";
import { contentPreviewSecret } from "./preview-link";
import { verifyContentPreviewToken } from "./preview-token";
import { rememberContentPublicRead } from "./public-cache";
import { contentPermissionsRoute } from "./public-permissions";
import { resolveContentPublicRowPeople } from "./public-row-hydration";
import {
  contentPublicSelection,
  createContentPublicProjector,
} from "./public-service";
import {
  contentPublicDeleteRoute,
  contentPublicVisibilityRoutes,
} from "./public-visibility-routes";
import { contentPublicWriteRoutes } from "./public-write-routes";
import {
  contentLocaleHeaders,
  resolveContentRequestLocale,
} from "./request-locale";
import {
  contentSnapshotRow,
  projectTranslationRevisionSnapshot,
} from "./revision-snapshot";
import { readContentThread, readContentThreadBranches } from "./thread";
import { resolveContentThreadRoot } from "./thread-access";

/**
 * The public routes of one content type: list and detail, plus preview,
 * delivery, thread and public-write routes when the definition enables them.
 * `buildContentPublicModule` mounts them; plugins do not call this directly.
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
  const containerField = contentContainerFieldOf(definition);
  const containerFilter =
    containerField &&
    definition.publicApi.filterableFields.includes(containerField.name)
      ? containerField
      : null;
  const listQuery = paginationQuery.extend({
    ...schemas.publicFilters.shape,
    ...(containerFilter
      ? { includeDescendants: z.enum(["true", "false"]).optional() }
      : {}),
  });
  const localeOnlyQuery = z.object(localeQuery);

  const notFound = () =>
    new HTTPException(404, {
      message: `${name} not found.`,
    });

  const project = createContentPublicProjector(definition);
  const accessModel = model as unknown as AnyContentModel;

  /**
   * A list filtered by the scope its records are filed in (a container, or an
   * `access.from` scope): `"notFound"` when the viewer may not see that scope,
   * `"accessRequired"` when they may see it but not read inside it.
   */
  const filterScopeRefusal = async (
    c: Context,
    filters: Record<string, unknown>,
  ): Promise<"accessRequired" | "notFound" | null> => {
    const source = contentAccessSourceOf(c, accessModel);
    if (!source || source.kind === "parent") return null;

    const requested = filters[source.field];
    const ids = (
      typeof requested === "object" && requested !== null && "in" in requested
        ? (requested as { in: unknown[] }).in
        : [requested]
    ).filter(
      (value): value is number | string =>
        typeof value === "number" || typeof value === "string",
    );
    if (ids.length === 0) return null;

    for (const id of ids) {
      const scopes = [{ family: source.family.id, scopeId: String(id) }];
      if (
        !(await decideContentAccessForScopes(c, { action: "view", scopes }))
          .allowed
      ) {
        return "notFound";
      }
      if (
        !(await decideContentAccessForScopes(c, { action: "read", scopes }))
          .allowed
      ) {
        return "accessRequired";
      }
    }

    return null;
  };

  /**
   * Which language this request is for, or `null` - always a 404. An explicit
   * `?locale=xx` naming no language this install serves is a request for
   * something that does not exist; a negotiated `Accept-Language` that matches
   * nothing falls through to the default instead.
   */
  const localeFor = async (c: Context) =>
    await resolveContentRequestLocale(c, definition);

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
        payload.i as ContentIdOf<TDefinition>,
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
                edges: z.array(
                  schemas.publicListSelect.and(
                    z.object({ hidden: z.literal(true).optional() }),
                  ),
                ),
                pageInfo: zodPaginationPageInfo,
              }),
            },
          },
          description: `Up to ${CONTENT_PUBLIC_MAX_PAGE_SIZE} published ${name} records`,
        },
        400: { description: "Invalid query parameters" },
        403: {
          content: {
            "application/json": { schema: zodContentAccessRequired },
          },
          description:
            "The filter names a scope the viewer may see but not read",
        },
        404: {
          description:
            "The requested locale is not served, or the container filter names a container that does not exist",
        },
      },
    },
    handler: async c => {
      // The whole query string goes through both schemas, each reading only the
      // keys it owns, and neither is strict - so a stale bookmark or a tracking
      // parameter is ignored rather than turned into a 400. `orderBy` is the
      // exception: a *present* but unknown column fails validation.
      const raw = c.req.query();
      const { cursor, first, last, order, orderBy, page, search } =
        paginationQuery.parse(raw);
      const filters = schemas.publicFilters.parse(
        raw,
      ) as ContentPublicFilterInput<TDefinition>;

      if (containerFilter) {
        const requested = (filters as Record<string, unknown>)[
          containerFilter.name
        ];
        if (typeof requested === "number") {
          const containers = createContentContainerService(c, {
            definition: containerFilter.field.definition,
            pluginId,
          });
          const ids = await containers.descendantIds(requested);
          if (!ids) {
            throw new HTTPException(404, { message: "Container not found." });
          }
          if (raw.includeDescendants === "true") {
            (filters as Record<string, unknown>)[containerFilter.name] = {
              in: ids,
            };
          }
        }
      }

      const refusal = await filterScopeRefusal(c, filters);
      if (refusal === "notFound") {
        throw new HTTPException(404, { message: "Container not found." });
      }
      if (refusal === "accessRequired") return contentAccessRequiredResponse(c);

      // An explicit locale naming no language this install serves is the same
      // 404 the detail route answers, not an empty list: an empty list would say
      // "this language has no articles", which is a different and untrue thing.
      const resolved = await localeFor(c);
      if (!resolved) throw notFound();

      const hidden = await contentListHiddenAccess(c, { model, pluginId });
      const shareable = await isContentAccessShareable(c, accessModel);
      const readPage = async () =>
        await service(c).findMany({
          filters,
          hidden,
          locale: resolved.locale,
          // Both narrowings restate what the schemas just proved: `orderBy`
          // came out of a literal enum built from `publicApi.orderableFields`,
          // and `filters` out of a shape built from
          // `publicApi.filterableFields`. The service re-checks both, since
          // the type is not what protects the query.
          orderBy: {
            column: orderBy as ContentPublicOrderableFieldName<TDefinition>,
            order,
          },
          query: { cursor, first, last, page, search },
        });

      if (hidden || !shareable) {
        return c.json(await readPage(), 200, {
          ...CONTENT_ACCESS_PRIVATE_HEADERS,
          ...contentLocaleHeaders(resolved),
        });
      }

      // A published list is the same for every reader, so it is cached under
      // everything that shapes it: the parsed query - never the raw string, so a
      // tracking parameter does not fork the key - and the resolved locale.
      const data = await rememberContentPublicRead(c, {
        contentTypeId: definition.id,
        key: {
          filters,
          locale: resolved.locale ?? null,
          query: { cursor, first, last, order, orderBy, page, search },
          route: "list",
          source: resolved.source,
        },
        load: readPage,
      });

      setPageCacheTags(c, [
        ...contentListPageCacheTags(definition),
        ...contentAccessPageCacheTags(c, accessModel),
        ...(containerFilter
          ? [contentContainerTag(containerFilter.field.definition.id)]
          : []),
      ]);

      return c.json(data, 200, contentLocaleHeaders(resolved));
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
            "application/json": { schema: schemas.publicSelect },
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
      const [withFiles] = await resolveContentPublicRowPeople(
        c,
        definition,
        await resolveContentPublicRowFiles(c, definition, [
          { ...row, ...translated },
        ]),
      );

      return c.json(
        {
          ...project(withFiles),
          ...(localized ? { locale: resolved.locale } : {}),
        },
        200,
        {
          "Cache-Control": "private, no-store",
          "X-Robots-Tag": "noindex, nofollow",
          ...contentLocaleHeaders(resolved),
        },
      );
    },
  });

  /** Rows for a thread read: public ones, plus hidden ones this reader may see. */
  const threadProjector =
    (c: Context, hiddenParents: boolean) =>
    async (ids: ContentId[], { hiddenIds }: { hiddenIds: ContentId[] }) => {
      const read = service(c).findManyByIds;
      const rows = read
        ? await read(ids as never, {
            hidden: hiddenIds.length > 0,
            hiddenParents,
          })
        : [];

      return new Map(
        rows.map(row => [String((row as unknown as { id: unknown }).id), row]),
      );
    };

  const serializeThreadNode = <
    T extends { deleted: ContentThreadNode<unknown>["deleted"] },
  >({
    deleted,
    ...item
  }: T) => ({
    ...item,
    deleted: deleted
      ? {
          byAuthor: deleted.byAuthor,
          createdAt: deleted.createdAt.toISOString(),
        }
      : null,
  });

  const threadNode = z.object({
    deleted: z
      .object({ byAuthor: z.boolean(), createdAt: z.string() })
      .nullable(),
    depth: z.number(),
    hidden: z.boolean(),
    hiddenReason: z.string().nullable(),
    id: schemas.params.shape.id,
    parentId: schemas.params.shape.id.nullable(),
    record: schemas.publicSelectObject.nullable(),
    removed: z.boolean(),
  });

  const thread = buildRoute({
    pluginId,
    route: {
      method: "get",
      path: "/thread",
      description: `Read the ${name} thread under one root record: a page of top-level ${name} records, oldest first, each followed by every public answer below it`,
      request: {
        query: z.object({
          root: z.string().min(1).max(64),
          first: z.coerce
            .number()
            .int()
            .min(1)
            .max(CONTENT_PUBLIC_MAX_PAGE_SIZE)
            .default(20),
          after: z.string().max(512).optional(),
        }),
      },
      responses: {
        200: {
          content: {
            "application/json": {
              schema: z.object({
                items: z.array(threadNode),
                pageInfo: z.object({
                  endCursor: z.string().nullable(),
                  hasNextPage: z.boolean(),
                  totalCount: z.number(),
                }),
                replyCount: z.number(),
                truncated: z.boolean(),
              }),
            },
          },
          description: "One page of the thread, flattened depth first",
        },
        404: { description: "The root record does not exist or is not public" },
      },
    },
    handler: async c => {
      const { after, first, root } = c.req.valid("query");
      const readable = await resolveContentThreadRoot(c, definition, root);
      if (!readable) {
        throw new HTTPException(404, { message: "Thread not found." });
      }

      const hiddenAccess = await contentThreadHiddenAccess(c, {
        model,
        pluginId,
      });
      const page = await readContentThread(c, model, {
        after,
        first,
        hiddenAccess,
        project: threadProjector(c, readable.hidden),
        root: readable.rootId,
      });

      const body = {
        ...page,
        items: page.items.map(serializeThreadNode),
      };

      if (
        hiddenAccess ||
        readable.hidden ||
        !(await isContentAccessShareable(c, accessModel))
      ) {
        return c.json(body, 200, CONTENT_ACCESS_PRIVATE_HEADERS);
      }

      setPageCacheTags(c, [
        ...contentListPageCacheTags(definition),
        ...contentAccessPageCacheTags(c, accessModel),
        ...contentListPageCacheTags(readable.target),
      ]);

      return c.json(body, 200);
    },
  });

  const threadBranch = z.discriminatedUnion("status", [
    z.object({
      id: schemas.params.shape.id,
      items: z.array(threadNode),
      status: z.literal("ok"),
    }),
    z.object({ id: schemas.params.shape.id, status: z.literal("gone") }),
  ]);

  /**
   * The current state of a few top-level branches already on a reader's
   * screen, so a live update re-reads one branch instead of every page. The
   * same root check, visibility, placeholders, depth and truncation as
   * `/thread`. Guests and readers with no hidden access get the same answer,
   * so it is read through the public read cache that every comment write
   * expires before it is announced; anyone else's answer is private.
   */
  const threadBranches = buildRoute({
    pluginId,
    route: {
      method: "get",
      path: "/thread/branches",
      description: `Re-read some top-level ${name} branches of one thread, each with every answer below it`,
      request: {
        query: z.object({
          root: z.string().min(1).max(64),
          ids: z
            .string()
            .max(CONTENT_THREAD_BRANCHES_MAX * 65)
            .optional(),
        }),
      },
      responses: {
        200: {
          content: {
            "application/json": {
              schema: z.object({
                branches: z.array(threadBranch),
                pageInfo: z.object({ totalCount: z.number() }),
                replyCount: z.number(),
                truncated: z.boolean(),
              }),
            },
          },
          description:
            "Each requested branch, in the order asked, or `gone` when the reader no longer sees it. Without `ids`, only the counts",
        },
        400: { description: "Malformed or too many ids" },
        404: { description: "The root record does not exist or is not public" },
      },
    },
    handler: async c => {
      const query = c.req.valid("query");
      const unique = new Map<string, ContentId>();
      for (const raw of (query.ids ?? "").split(",")) {
        const trimmed = raw.trim();
        if (trimmed === "") continue;
        const id = parseContentId(definition.idStrategy, trimmed);
        if (id === null) {
          throw new HTTPException(400, { message: "Invalid branch id." });
        }
        if (!unique.has(String(id))) unique.set(String(id), id);
      }
      const ids = [...unique.values()];
      if (ids.length > CONTENT_THREAD_BRANCHES_MAX) {
        throw new HTTPException(400, {
          message: `Ask for at most ${CONTENT_THREAD_BRANCHES_MAX} branches at once.`,
        });
      }

      const readable = await resolveContentThreadRoot(
        c,
        definition,
        query.root,
      );
      if (!readable) {
        throw new HTTPException(404, { message: "Thread not found." });
      }

      const hiddenAccess = await contentThreadHiddenAccess(c, {
        model,
        pluginId,
      });
      const load = async () => {
        const result = await readContentThreadBranches(c, model, {
          hiddenAccess,
          ids,
          project: threadProjector(c, readable.hidden),
          root: readable.rootId,
        });

        return {
          ...result,
          branches: result.branches.map(branch =>
            branch.status === "ok"
              ? { ...branch, items: branch.items.map(serializeThreadNode) }
              : branch,
          ),
        };
      };

      if (hiddenAccess || readable.hidden) {
        return c.json(await load(), 200, {
          "Cache-Control": "private, no-store",
        });
      }

      const body = await rememberContentPublicRead(c, {
        contentTypeId: definition.id,
        key: {
          ids: ids.map(String),
          root: String(readable.rootId),
          route: "thread-branches",
        },
        load,
      });

      // Every viewer of a busy thread asks for the same branch after one
      // signal: the read cache above answers them, and no shared HTTP cache
      // may hold a copy that outlives the next write.
      return c.json(body, 200, { "Cache-Control": "no-cache" });
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
            "application/json": { schema: schemas.publicSelect },
          },
          description: `${name} found`,
        },
        403: {
          content: {
            "application/json": { schema: zodContentAccessRequired },
          },
          description: `${name} is in a scope the viewer may see but not read. The body says only that`,
        },
        404: { description: `${name} not found` },
      },
    },
    handler: async c => {
      const resolved = await localeFor(c);
      if (!resolved) throw notFound();
      const shareable = await isContentAccessShareable(c, accessModel);

      // A draft, an unpublished row, a cleared publication date, a translation
      // that is not published in this language and a typo are all the same 404.
      // A 403 would confirm the record exists, which is the one thing a draft
      // URL must not do - and so would a 404 that only some of them produced.
      const slug = c.req.param("slug");
      const readRow = async () =>
        await service(c).findBySlug(slug, {
          fallback: true,
          locale: resolved.locale,
        });
      // Only a read no access rule can change is cached - it is the same for
      // every reader. The hidden fallback below depends on who is asking and
      // never is.
      const row = shareable
        ? await rememberContentPublicRead(c, {
            contentTypeId: definition.id,
            key: {
              locale: resolved.locale ?? null,
              route: "detail",
              slug,
              source: resolved.source,
            },
            load: readRow,
          })
        : await readRow();
      if (row && !shareable) {
        return c.json(row, 200, {
          ...CONTENT_ACCESS_PRIVATE_HEADERS,
          ...contentLocaleHeaders(resolved),
        });
      }
      if (row) {
        setPageCacheTags(c, [
          ...contentRecordPageCacheTags(
            definition,
            parseContentId(
              definition.idStrategy,
              (row as Record<string, unknown>).id,
            ),
          ),
          ...contentAccessPageCacheTags(c, accessModel),
        ]);

        return c.json(row, 200, contentLocaleHeaders(resolved));
      }

      const hidden = await findViewableHiddenBySlug(c, {
        locale: resolved.locale,
        model,
        pluginId,
        slug,
      });
      if (!hidden) {
        if (shareable) throw notFound();

        // Published, but outside what this viewer may read: say so only when
        // they may see where it is filed, and say nothing else about it.
        const existing = await service(c).findBySlug(slug, {
          actor: CONTENT_ACCESS_SYSTEM_ACTOR,
          fallback: true,
          locale: resolved.locale,
          select: ["id"],
        });
        const id = existing
          ? parseContentId(
              definition.idStrategy,
              (existing as Record<string, unknown>).id,
            )
          : null;
        if (
          id !== null &&
          (await contentAccessMissReason(c, accessModel, id)) ===
            "accessRequired"
        ) {
          return contentAccessRequiredResponse(c);
        }

        throw notFound();
      }

      return c.json(hidden, 200, {
        "Cache-Control": "private, no-store",
        // The body is the record as usual; this is how a page tells its author
        // or a moderator that readers cannot see it.
        [CONTENT_HIDDEN_HEADER]: "true",
        "X-Robots-Tag": "noindex, nofollow",
        ...contentLocaleHeaders(resolved),
      });
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
    ...(definition.thread.enabled ? [thread, threadBranches] : []),
    ...(definition.publicWrite.enabled ||
    definition.reports.enabled ||
    definition.visibility.enabled
      ? [contentPermissionsRoute(model, { pluginId })]
      : []),
    ...(definition.visibility.enabled &&
    (definition.publicWrite.enabled || definition.reports.enabled)
      ? contentPublicVisibilityRoutes(model, { pluginId })
      : []),
    ...(definition.publicWrite.enabled
      ? [contentPublicDeleteRoute(model, { pluginId })]
      : []),
    // Three segments, so it never shadows `/{slug}`. Mounted for every type
    // that exposes a file or a rich-text document, which is where protected
    // files and their authorized URLs come from.
    ...(definition.publicApi.fields.some(field => {
      const kind = definition.fields[field]?.kind;

      return kind === "file" || kind === "richText";
    })
      ? [contentFileDownloadRoute(model, { pluginId })]
      : []),
    detail,
    ...contentPublicWriteRoutes(model, { pluginId }),
  ];
};
