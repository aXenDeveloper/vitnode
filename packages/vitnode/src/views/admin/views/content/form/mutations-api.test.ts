// @vitest-environment node
import { requestHandler } from "@tanstack/react-start/server";
import {
  afterEach,
  aroundEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  createContentInBrowser,
  editContentInBrowser,
  editLocalizedContentInBrowser,
  loadContentOptionsInBrowser,
  setContentPublishedInBrowser,
} from "./mutations-api";

const API_ORIGIN = "http://api.test";
const MODULE_PATH = "/api/@vitnode/blog/admin/content/posts";

const TARGET = { permissionModule: "posts", pluginId: "@vitnode/blog" };

let respond = (): Response => new Response(null, { status: 200 });

const apiFetch = vi.fn<typeof fetch>(
  async () => await Promise.resolve(respond()),
);

const sent = (index = 0) => {
  const [url, init] = apiFetch.mock.calls[index] ?? [];

  if (!(url instanceof URL)) throw new Error("no request reached fetch");

  const body: unknown =
    typeof init?.body === "string" ? JSON.parse(init.body) : undefined;

  return {
    body,
    method: init?.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
  };
};

const answers = (status: number, body: unknown) => {
  respond = () => new Response(JSON.stringify(body), { status });
};

const refuses = (status: number, body: string) => {
  respond = () => new Response(body, { status });
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

const insideStartRequest = async (
  runTest: () => Promise<void>,
): Promise<void> => {
  await requestHandler(async () => {
    await runTest();

    return new Response(null, { status: 204 });
  })(new Request(`${API_ORIGIN}/admin/content/posts`), undefined);
};

aroundEach(insideStartRequest);

beforeEach(() => {
  respond = () => new Response(null, { status: 200 });
  apiFetch.mockClear();
  vi.stubEnv("VITNODE_API_URL", API_ORIGIN);
  vi.stubGlobal("fetch", apiFetch);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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
    refuses(500, "boom");

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

    expect(sent()).toMatchObject({
      body: { expectedVersion: 4, values: { title: "Hi" } },
      method: "PUT",
      path: `${MODULE_PATH}/7`,
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

    expect(sent().body).toEqual({ title: "Hi" });
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

    expect(sent().body).not.toHaveProperty("expectedVersion");
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

    expect(sent()).toMatchObject({
      body: {
        expectedVersion: 4,
        translations: [
          { expectedVersion: 9, locale: "pl", values: { t: "x" } },
        ],
      },
      method: "PUT",
      path: `${MODULE_PATH}/7/localized`,
    });
    expect(sent().body).not.toHaveProperty("values");
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

    expect(apiFetch).not.toHaveBeenCalled();
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
    expect(sent()).toMatchObject({
      method: "POST",
      path: `${MODULE_PATH}/7/publish`,
    });
  });

  it("addresses the unpublish route for the other direction", async () => {
    answers(200, { changed: true, row: { id: 7 } });

    await setContentPublishedInBrowser(TARGET, 7, "unpublish");

    expect(sent().path).toBe(`${MODULE_PATH}/7/unpublish`);
  });
});

describe("picker options", () => {
  it("passes an option's colour, face and handle straight through", async () => {
    // Spread rather than rebuilt key by key: a hand-listed object is how `color`
    // once reached the browser as `undefined` while its label came through fine.
    // This is the only test pinning it.
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

    expect(sent()).toMatchObject({
      method: "GET",
      path: `${MODULE_PATH}/options/categoryId`,
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
