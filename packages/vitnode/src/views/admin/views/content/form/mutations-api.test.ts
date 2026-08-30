// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type * as contentRequest from "../content-request";
import type { ContentApiRequest } from "../content-request";

const fetchMock = vi.fn<(request: ContentApiRequest) => Promise<Response>>();

/**
 * Only the browser fetch is replaced.
 *
 * `contentApiFetchArgs` stays real, so the URL every assertion below reads is
 * the one the AdminCP would actually build - a mock of the whole module would
 * let a wrong path pass.
 */
vi.mock("../content-request", async () => {
  const actual =
    await vi.importActual<typeof contentRequest>("../content-request");

  return {
    ...actual,
    contentApiFetchInBrowser: async (request: ContentApiRequest) =>
      await fetchMock(request),
  };
});

const {
  createContentInBrowser,
  editContentInBrowser,
  editLocalizedContentInBrowser,
  loadContentOptionsInBrowser,
  setContentPublishedInBrowser,
} = await import("./mutations-api");

/**
 * The browser half of the Content Engine's writes, at the seam every other test
 * stubs out.
 *
 * What matters here is not that a request is made - it is that the *answer* is
 * read exactly as `mutation-api.server.ts` reads it. A version conflict and a
 * unique clash share a `409` and need different dialogs; an editorial edit sends
 * its precondition in a wrapper and a non-editorial one must not; a save with
 * nothing in it must not reach the API at all. Each of those is a silent bug in
 * the AdminCP if this file disagrees with the Server Action.
 */

const TARGET = { permissionModule: "posts", pluginId: "@vitnode/blog" };

/**
 * A fresh `Response` per call, never one shared instance.
 *
 * A body can be read once, and a composite save makes two requests - the write,
 * then the read-back of every translation. `mockResolvedValue` would hand the
 * same object to both and the second would throw "Body has already been read",
 * which is a fact about the test rather than about the code.
 */
const answers = (status: number, body: unknown) => {
  fetchMock.mockImplementation(
    async () =>
      await Promise.resolve(new Response(JSON.stringify(body), { status })),
  );
};

const refuses = (status: number, body: string) => {
  fetchMock.mockImplementation(
    async () => await Promise.resolve(new Response(body, { status })),
  );
};

const versionConflict = JSON.stringify({
  code: "CONTENT_VERSION_CONFLICT",
  contentTypeId: "blog.post",
  currentVersion: 9,
  expectedVersion: 4,
  itemId: 7,
});

const uniqueConflict = JSON.stringify({
  code: "CONTENT_UNIQUE_CONFLICT",
  contentTypeId: "blog.post",
  itemId: 7,
});

beforeEach(() => {
  fetchMock.mockReset();
});

describe("a refused write", () => {
  it("reads a version conflict as a conflict, not as a sentence", async () => {
    // The whole conflict flow hangs off this: the form opens `ConflictNotice`
    // when `conflict.code` is `CONTENT_VERSION_CONFLICT`, and shows a toast for
    // anything else. A 409 read as text loses the reload path entirely.
    refuses(409, versionConflict);

    await expect(
      editContentInBrowser(TARGET, {
        editorial: true,
        expectedVersion: 4,
        id: 7,
        values: { title: "Hi" },
      }),
    ).resolves.toMatchObject({
      conflict: { code: "CONTENT_VERSION_CONFLICT", currentVersion: 9 },
      status: 409,
    });
  });

  it("keeps a unique clash distinguishable from a version conflict", async () => {
    refuses(409, uniqueConflict);

    const result = await editContentInBrowser(TARGET, {
      editorial: true,
      expectedVersion: 4,
      id: 7,
      values: { slug: "taken" },
    });

    expect(result.conflict?.code).toBe("CONTENT_UNIQUE_CONFLICT");
  });

  it("carries the status through for everything else", async () => {
    refuses(403, "Forbidden");

    await expect(
      createContentInBrowser(TARGET, { title: "Hi" }),
    ).resolves.toMatchObject({ error: "Forbidden", status: 403 });
  });

  it("turns an unreachable API into a 500 result rather than a throw", async () => {
    // `rawApiFetch` throws on a 500. A form that is still open with the editor's
    // unsaved text in it has to receive a result, or the error boundary replaces
    // it and the work is gone.
    fetchMock.mockRejectedValue(new Error("500 - /api/…\nboom"));

    await expect(
      createContentInBrowser(TARGET, { title: "Hi" }),
    ).resolves.toMatchObject({ status: 500 });
  });

  it("refuses a body the content type does not describe", async () => {
    // A plugin and an API that disagree about a shape is a deployment fault.
    // Reporting it beats saving half a record on the strength of it.
    answers(201, { notAnId: true });

    const result = await createContentInBrowser(TARGET, { title: "Hi" });

    expect(result.error).toContain("does not describe");
  });
});

describe("the version precondition", () => {
  it("wraps an editorial edit's values so the API sees the precondition", async () => {
    answers(200, { id: 7, version: 5 });

    await editContentInBrowser(TARGET, {
      editorial: true,
      expectedVersion: 4,
      id: 7,
      values: { title: "Hi" },
    });

    expect(fetchMock.mock.calls[0]?.[0]).toMatchObject({
      body: { expectedVersion: 4, values: { title: "Hi" } },
      method: "put",
      path: "/7",
    });
  });

  it("sends a non-editorial edit's values bare", async () => {
    // The route for a content type without `editorial` takes the row itself, and
    // a wrapper would be an unknown field rather than a precondition.
    answers(200, { id: 7 });

    await editContentInBrowser(TARGET, {
      editorial: false,
      expectedVersion: 4,
      id: 7,
      values: { title: "Hi" },
    });

    expect(fetchMock.mock.calls[0]?.[0]).toMatchObject({
      body: { title: "Hi" },
    });
  });

  it("reads the version back, so the next save guards on the right one", async () => {
    // A page-mode form stays open. Its second save must send the version this
    // write created, not the one the screen opened with.
    answers(200, { id: 7, version: 5 });

    await expect(
      editContentInBrowser(TARGET, {
        editorial: true,
        expectedVersion: 4,
        id: 7,
        values: { title: "Hi" },
      }),
    ).resolves.toEqual({ version: 5 });
  });

  it("has no version for a content type that has none", async () => {
    answers(200, { id: 7 });

    await expect(
      editContentInBrowser(TARGET, {
        editorial: false,
        id: 7,
        values: { title: "Hi" },
      }),
    ).resolves.toEqual({ version: undefined });
  });

  it("omits the precondition from a localized save that has none", async () => {
    answers(200, { id: 7 });

    await editLocalizedContentInBrowser(TARGET, {
      id: 7,
      translations: [{ locale: "pl", values: { title: "Witaj" } }],
      values: undefined,
    });

    expect(fetchMock.mock.calls[0]?.[0].body).not.toHaveProperty(
      "expectedVersion",
    );
  });

  it("omits the shared half of a localized save when nothing shared moved", async () => {
    // A Polish-only edit must not write a base revision.
    answers(200, { id: 7 });

    await editLocalizedContentInBrowser(TARGET, {
      expectedVersion: 4,
      id: 7,
      translations: [{ expectedVersion: 9, locale: "pl", values: { t: "x" } }],
      values: undefined,
    });

    expect(fetchMock.mock.calls[0]?.[0]).toMatchObject({
      body: {
        expectedVersion: 4,
        translations: [
          { expectedVersion: 9, locale: "pl", values: { t: "x" } },
        ],
      },
      path: "/7/localized",
    });
    expect(fetchMock.mock.calls[0]?.[0].body).not.toHaveProperty("values");
  });
});

describe("a save with nothing in it", () => {
  it("never reaches the API", async () => {
    await expect(
      editLocalizedContentInBrowser(TARGET, {
        id: 7,
        translations: [],
        values: undefined,
      }),
    ).resolves.toEqual({ unchanged: true });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is reported as unchanged rather than as a success", async () => {
    // "Saved" and "there was nothing to save" are different things to the person
    // who pressed the button, and the form says different words for them.
    const result = await editLocalizedContentInBrowser(TARGET, {
      id: 7,
      translations: [],
      values: undefined,
    });

    expect(result.error).toBeUndefined();
    expect(result.unchanged).toBe(true);
  });
});

describe("publication", () => {
  it("reads the version off the row a transition returns", async () => {
    answers(200, { changed: true, row: { id: 7, version: 6 } });

    await expect(
      setContentPublishedInBrowser(TARGET, 7, "publish"),
    ).resolves.toEqual({ version: 6 });
    expect(fetchMock.mock.calls[0]?.[0]).toMatchObject({
      method: "post",
      path: "/7/publish",
    });
  });

  it("addresses the unpublish route for the other direction", async () => {
    answers(200, { changed: true, row: { id: 7 } });

    await setContentPublishedInBrowser(TARGET, 7, "unpublish");

    expect(fetchMock.mock.calls[0]?.[0].path).toBe("/7/unpublish");
  });
});

describe("picker options", () => {
  it("passes an option's colour, face and handle straight through", async () => {
    // Spread rather than rebuilt key by key - the Server Action's own test pins
    // the same thing, because a hand-listed object is how `color` once reached
    // the browser as `undefined` while its label came through fine.
    answers(200, {
      items: [
        { avatarColor: "3b82f6", label: "Ada", nameCode: "ada", value: 7 },
        { color: "hsl(200, 60%, 50%)", label: "News", value: 1 },
      ],
    });

    await expect(
      loadContentOptionsInBrowser(TARGET, "authorId", "ad"),
    ).resolves.toEqual([
      { avatarColor: "3b82f6", label: "Ada", nameCode: "ada", value: "7" },
      { color: "hsl(200, 60%, 50%)", label: "News", value: "1" },
    ]);
  });

  it("asks for identifiers instead of a search when given them", async () => {
    answers(200, { items: [] });

    await loadContentOptionsInBrowser(TARGET, "categoryId", "", [3, 9]);

    expect(fetchMock.mock.calls[0]?.[0]).toMatchObject({
      path: "/options/categoryId",
      query: { ids: "3,9" },
    });
  });

  it("bounds a label lookup by the identifiers asked for", async () => {
    answers(200, {
      items: [
        { label: "One", value: 1 },
        { label: "Two", value: 2 },
      ],
    });

    await expect(
      loadContentOptionsInBrowser(TARGET, "categoryId", "", [1]),
    ).resolves.toHaveLength(1);
  });
});
