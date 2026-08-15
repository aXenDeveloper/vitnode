import { describe, expect, it, vi } from "vitest";

/**
 * The picker's own server action, tested at the seam every other picker test
 * stubs out.
 *
 * Every component test hands the field a `loadOptions` of its own, so nothing
 * exercised the *action* - and the action rebuilt each option key by key, which
 * meant a `color` the API sent arrived in the browser as `undefined` while its
 * label came through fine. The bug was invisible to a suite that never crossed
 * this line.
 */
const fetchMock = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/content/admin/config", () => ({
  findFrontendContentType: () => ({
    definition: { publicApi: { enabled: false, slugField: "slug" } },
    pluginId: "@vitnode/blog",
  }),
}));
vi.mock("@/content/admin/fetch.server", () => ({
  contentApiFetch: async (args: unknown) => await fetchMock(args),
}));
vi.mock("@/content/next/revalidate.server", () => ({
  revalidateContent: vi.fn(),
}));
vi.mock("./public-locale-cache", () => ({
  invalidateContentLocales: vi.fn(),
  readContentPublicLocales: vi.fn(),
}));

const { loadContentOptionsAction } = await import("./mutation-api.server");

describe("loadContentOptionsAction", () => {
  it("passes an option's colour through to the picker", async () => {
    fetchMock.mockResolvedValue({
      data: {
        items: [{ color: "hsl(200, 60%, 50%)", label: "ttt", value: 1 }],
      },
    });

    await expect(
      loadContentOptionsAction("blog.post", "categoryId", ""),
    ).resolves.toEqual([
      { color: "hsl(200, 60%, 50%)", label: "ttt", value: "1" },
    ]);
  });

  it("passes a person's face and handle through as well", async () => {
    fetchMock.mockResolvedValue({
      data: {
        items: [
          { avatarColor: "3b82f6", label: "Ada", nameCode: "ada", value: 7 },
        ],
      },
    });

    await expect(
      loadContentOptionsAction("blog.post", "authorId", "ad"),
    ).resolves.toEqual([
      { avatarColor: "3b82f6", label: "Ada", nameCode: "ada", value: "7" },
    ]);
  });

  it("asks for identifiers instead of a search when given them", async () => {
    fetchMock.mockResolvedValue({ data: { items: [] } });

    await loadContentOptionsAction("blog.post", "categoryId", "", [3, 9]);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/options/categoryId",
        query: { ids: "3,9" },
      }),
    );
  });
});
