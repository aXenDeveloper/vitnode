// @vitest-environment node
import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { testEditorialPostContentType } from "@/tests/content-fixtures";

import type { ContentRevisionSnapshot } from "../revisions";

import { createContentModel } from "./model";
import { createContentPreviewToken } from "./preview-token";
import { buildContentPublicRoutes } from "./public-routes";

const PLUGIN_ID = "@vitnode/example";
// The shape of what an install generates for itself: 32-ish random bytes. See
// `preview-secret.test.ts` for where that value comes from.
const SECRET = "unit-test-content-preview-secret-0123456789";

const posts = createContentModel(testEditorialPostContentType);

const snapshot = (
  overrides?: Partial<ContentRevisionSnapshot>,
): ContentRevisionSnapshot => ({
  contentTypeId: testEditorialPostContentType.id,
  createdAt: "2026-08-01T09:00:00.000Z",
  fields: {
    excerpt: "Not published yet",
    slug: "hello-world",
    title: "Hello world",
    // Private: absent from `publicApi.fields`, so it must never reach a body.
    views: 4242,
  },
  id: 7,
  publication: { publishedAt: null, status: "draft" },
  schemaVersion: 1,
  updatedAt: "2026-08-02T09:00:00.000Z",
  version: 3,
  ...overrides,
});

const harness = ({ secret = SECRET }: { secret?: string } = {}) => {
  const findById = vi.fn();
  const selections: Record<string, unknown>[] = [];
  const liveRows: Record<string, unknown>[] = [];

  const db = {
    select: (selection: Record<string, unknown>) => {
      selections.push(selection);

      return {
        from: () => ({
          where: () => ({ limit: async () => Promise.resolve(liveRows) }),
        }),
      };
    },
  };

  vi.spyOn(posts, "editorialService", "get").mockReturnValue(
    () => ({ revisions: { findById } }) as never,
  );

  const app = new OpenAPIHono();
  app.use("*", async (c, next) => {
    c.set("db", db as never);
    c.set("core", { contentPreviewSecret: secret } as never);
    await next();
  });
  for (const { handler, route } of buildContentPublicRoutes(posts, {
    pluginId: PLUGIN_ID,
  })) {
    app.openapi(route, handler);
  }

  return { app, findById, liveRows, selections };
};

const mint = (overrides?: { itemId?: number; revisionId?: number }) =>
  createContentPreviewToken({
    definition: testEditorialPostContentType,
    itemId: overrides?.itemId ?? 7,
    pluginId: PLUGIN_ID,
    revisionId: overrides?.revisionId ?? 42,
    secret: SECRET,
    version: 3,
  }).token;

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("the public preview route", () => {
  it("returns an unpublished record to a caller with no session", async () => {
    const { app, findById } = harness();
    findById.mockResolvedValue({ snapshot: snapshot() });

    const res = await app.request(`/preview/${mint()}`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      excerpt: "Not published yet",
      publishedAt: null,
      slug: "hello-world",
      title: "Hello world",
    });
  });

  it("never returns a private field", async () => {
    // The fixture's `views` is deliberately absent from `publicApi.fields`. If
    // the preview projected the snapshot itself instead of going through
    // `createContentPublicProjector`, this is the test that would catch it.
    const { app, findById } = harness();
    findById.mockResolvedValue({ snapshot: snapshot() });

    const body = await (await app.request(`/preview/${mint()}`)).json();

    expect(body).not.toHaveProperty("views");
    expect(JSON.stringify(body)).not.toContain("4242");
  });

  it("marks the response private and unindexable", async () => {
    const { app, findById } = harness();
    findById.mockResolvedValue({ snapshot: snapshot() });

    const res = await app.request(`/preview/${mint()}`);

    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("asks for the revision scoped by the record in the token", async () => {
    const { app, findById } = harness();
    findById.mockResolvedValue({ snapshot: snapshot() });

    await app.request(`/preview/${mint({ itemId: 7, revisionId: 42 })}`);

    // Both arguments, always: the revisions table is shared, so a revision id
    // on its own proves nothing about which record it belongs to.
    expect(findById).toHaveBeenCalledWith(7, 42);
  });

  it("reads the live row when the record has no revision", async () => {
    const { app, findById, liveRows, selections } = harness();
    liveRows.push({
      excerpt: "Never edited since editorial was enabled",
      id: 7,
      publishedAt: null,
      slug: "hello-world",
      title: "Hello world",
    });

    const res = await app.request(`/preview/${mint({ revisionId: 0 })}`);

    expect(res.status).toBe(200);
    expect(findById).not.toHaveBeenCalled();
    // Even on the live path the SELECT is the public allowlist plus the cursor,
    // so a private column is never fetched in the first place.
    expect(Object.keys(selections[0]).sort()).toEqual([
      "excerpt",
      "id",
      "publishedAt",
      "slug",
      "title",
    ]);
  });

  it.each([
    ["a forged signature", "eyJhIjoxfQ.bm90LWEtc2lnbmF0dXJl"],
    ["garbage", "not-a-token"],
    ["an empty token", "%20"],
  ])("answers 404 for %s", async (_name, token) => {
    const { app } = harness();

    expect((await app.request(`/preview/${token}`)).status).toBe(404);
  });

  it("answers 404 when the revision is gone", async () => {
    // Pruned by retention, or the record was deleted. Same 404 as a forged
    // token, deliberately - the reviewer learns nothing either way.
    const { app, findById } = harness();
    findById.mockResolvedValue(null);

    expect((await app.request(`/preview/${mint()}`)).status).toBe(404);
  });

  it("answers 404 when a live-row token points at nothing", async () => {
    const { app } = harness();

    expect(
      (await app.request(`/preview/${mint({ revisionId: 0 })}`)).status,
    ).toBe(404);
  });

  it("answers 404 for a token signed with another secret", async () => {
    const { app } = harness();
    const token = createContentPreviewToken({
      definition: testEditorialPostContentType,
      itemId: 7,
      pluginId: PLUGIN_ID,
      revisionId: 42,
      secret: "someone-elses-secret",
      version: 3,
    }).token;

    expect((await app.request(`/preview/${token}`)).status).toBe(404);
  });

  it("refuses a token forged with a guessable secret", async () => {
    // The attack that used to need a fail-closed rule: while the fallback key
    // shipped in the published source, an attacker could sign `{ i: 7, r: 0 }`
    // themselves and walk the ids. There is no published key to guess any more -
    // every install signs with 32 bytes it generated - so the forgery is just a
    // wrong signature.
    const { app, findById, liveRows } = harness();
    findById.mockResolvedValue({ snapshot: snapshot() });
    liveRows.push({ id: 7, title: "Hello world" });

    const token = createContentPreviewToken({
      definition: testEditorialPostContentType,
      itemId: 7,
      pluginId: PLUGIN_ID,
      revisionId: 0,
      secret: "default-content-preview-secret-change-in-production",
      version: 3,
    }).token;

    expect((await app.request(`/preview/${token}`)).status).toBe(404);
    // Nothing was even looked up: no oracle, and no wasted query.
    expect(findById).not.toHaveBeenCalled();
  });

  it("says nothing different for any of them", async () => {
    const { app, findById } = harness();
    findById.mockResolvedValue(null);

    const bodies = await Promise.all(
      ["not-a-token", mint(), mint({ itemId: 999 })].map(async token =>
        (await app.request(`/preview/${token}`)).text(),
      ),
    );

    // A distinguishable message is a record-existence oracle, which is the one
    // thing a draft URL must not be.
    expect(new Set(bodies).size).toBe(1);
  });
});

describe("route registration", () => {
  it("declares no staff permission, deliberately", () => {
    // The signed, expiring token *is* the authorization. Asserted rather than
    // assumed, because adding one would silently break every preview link and
    // removing one elsewhere must never look like this.
    const routes = buildContentPublicRoutes(posts, { pluginId: PLUGIN_ID });
    const preview = routes.find(
      entry => entry.route.path === "/preview/{token}",
    );

    expect(preview).toBeDefined();
    expect(preview).not.toHaveProperty("adminStaffPermission");
  });

  it("cannot shadow a record whose slug is literally 'preview'", async () => {
    const { app } = harness();
    const service = {
      findById: vi.fn(),
      findBySlug: vi.fn(),
      findMany: vi.fn(),
    };
    vi.spyOn(posts, "publicService", "get").mockReturnValue(() => service);
    service.findBySlug.mockResolvedValue({ slug: "preview", title: "Preview" });

    const res = await app.request("/preview");

    expect(res.status).toBe(200);
    expect(service.findBySlug).toHaveBeenCalledWith("preview", {
      locale: undefined,
    });
  });
});
