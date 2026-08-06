import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ContentFormSpec } from "@/content/admin/spec";
import type { ContentRevisionMeta } from "@/content/revisions";

vi.mock("next-intl", () => {
  const useTranslations = (namespace: string) => {
    const t = (key: string) => `${namespace}.${key}`;
    t.rich = (key: string) => `${namespace}.${key}`;

    return t;
  };

  return { useTranslations };
});

// Locale formatting is not what this suite is about, and the real component
// pulls in `useFormatter`/`useNow` from the provider tree.
vi.mock("@/components/date-format", () => ({
  DateFormat: ({ date }: { date: Date | string }) => (
    <span>{String(date)}</span>
  ),
}));

const push = vi.fn();
vi.mock("@/lib/navigation", () => ({
  usePathname: () => "/admin/content/test/editorial",
  useRouter: () => ({ push }),
}));

let canRestore = true;
vi.mock("@/components/staff-permission/provider", () => ({
  useAdminStaffPermission: () => canRestore,
}));

const listContentRevisionsAction = vi.fn();
const restoreContentRevisionAction = vi.fn();
vi.mock("../mutation-api.server", () => ({
  getContentRevisionAction: vi.fn().mockResolvedValue({ revision: undefined }),
  listContentRevisionsAction: (...args: unknown[]) =>
    listContentRevisionsAction(...args),
  restoreContentRevisionAction: (...args: unknown[]) =>
    restoreContentRevisionAction(...args),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const { RevisionHistory } = await import("./revision-history");

const spec: ContentFormSpec = {
  contentTypeId: "test.editorial",
  fields: [
    {
      kind: "text",
      label: "Title",
      name: "title",
      nullable: false,
      required: true,
    },
  ],
  pluginId: "@vitnode/test",
  titleField: "title",
};

const revision = (version: number): ContentRevisionMeta => ({
  actorName: "Ada",
  actorType: "staff",
  actorUserId: 1,
  changedFields: ["title"],
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  id: 1000 + version,
  operation: "update",
  restoredFromRevisionId: null,
  version,
});

const page = (
  versions: number[],
  { hasNextPage = false }: { hasNextPage?: boolean } = {},
) => ({
  edges: versions.map(revision),
  pageInfo: { endCursor: versions.at(-1) ?? null, hasNextPage },
});

const view = () =>
  render(
    <RevisionHistory
      contentTypeId="test.editorial"
      currentVersion={50}
      id={7}
      permissionModule="editorial"
      pluginId="@vitnode/test"
      singular="Post"
      spec={spec}
      title="Hello world"
    />,
  );

beforeEach(() => {
  vi.clearAllMocks();
  canRestore = true;
});

describe("RevisionHistory", () => {
  it("shows the first page", async () => {
    listContentRevisionsAction.mockResolvedValue(page([50, 49]));

    view();

    expect(await screen.findByText("v50")).not.toBeNull();
    expect(screen.getByText("v49")).not.toBeNull();
  });

  it("offers another page only when there is one", async () => {
    listContentRevisionsAction.mockResolvedValue(page([50, 49]));

    view();

    await screen.findByText("v50");
    expect(screen.queryByText("core.content.history.load_more")).toBeNull();
  });

  it("appends the next page instead of replacing what is on screen", async () => {
    // The whole point: the default retention is 50 and the default page is 25,
    // so half the history used to be unreachable.
    listContentRevisionsAction
      .mockResolvedValueOnce(page([50, 49], { hasNextPage: true }))
      .mockResolvedValueOnce(page([48, 47]));

    view();
    fireEvent.click(await screen.findByText("core.content.history.load_more"));

    await waitFor(() => {
      expect(screen.getByText("v47")).not.toBeNull();
    });
    // Still there. Replacing would lose the versions the reader scrolled past.
    expect(screen.getByText("v50")).not.toBeNull();
  });

  it("asks for the next page from the last version it has", async () => {
    listContentRevisionsAction
      .mockResolvedValueOnce(page([50, 49], { hasNextPage: true }))
      .mockResolvedValueOnce(page([48, 47]));

    view();
    fireEvent.click(await screen.findByText("core.content.history.load_more"));

    await waitFor(() => {
      expect(listContentRevisionsAction).toHaveBeenCalledWith(
        "test.editorial",
        7,
        49,
      );
    });
  });

  it("hides the button once the last page arrives", async () => {
    listContentRevisionsAction
      .mockResolvedValueOnce(page([50, 49], { hasNextPage: true }))
      .mockResolvedValueOnce(page([48, 47]));

    view();
    fireEvent.click(await screen.findByText("core.content.history.load_more"));

    await waitFor(() => {
      expect(screen.queryByText("core.content.history.load_more")).toBeNull();
    });
  });

  it("never shows the same revision twice", async () => {
    // Belt and braces on top of the exclusive cursor: a server that repeated
    // the boundary row must not produce a duplicate React key or a duplicate
    // line for a reader.
    listContentRevisionsAction
      .mockResolvedValueOnce(page([50, 49], { hasNextPage: true }))
      .mockResolvedValueOnce(page([49, 48]));

    view();
    fireEvent.click(await screen.findByText("core.content.history.load_more"));

    await waitFor(() => {
      expect(screen.getByText("v48")).not.toBeNull();
    });
    expect(screen.getAllByText("v49")).toHaveLength(1);
  });

  it("shows an error rather than an empty list", async () => {
    listContentRevisionsAction.mockResolvedValue({
      edges: [],
      error: "The API is unhappy",
      pageInfo: { endCursor: null, hasNextPage: false },
    });

    view();

    expect(await screen.findByText("The API is unhappy")).not.toBeNull();
  });

  describe("after a restore", () => {
    const restore = async () => {
      listContentRevisionsAction.mockResolvedValue(page([50, 49]));
      restoreContentRevisionAction.mockResolvedValue({ version: 51 });

      view();
      // The confirmation dialog's trigger, on the older revision.
      fireEvent.click(
        (await screen.findAllByText("core.content.history.restore.action"))[0],
      );
      fireEvent.click(
        await screen.findByText("core.content.history.restore.confirm"),
      );
    };

    it("posts the version the record currently holds", async () => {
      await restore();

      await waitFor(() => {
        expect(restoreContentRevisionAction).toHaveBeenCalledWith(
          "test.editorial",
          7,
          1049,
          50,
        );
      });
    });

    it("reloads the history, so the restore's own revision shows up", async () => {
      await restore();

      await waitFor(() => {
        // Once on mount, once after the restore.
        expect(listContentRevisionsAction).toHaveBeenCalledTimes(2);
      });
    });

    it("refreshes the table behind the dialog", async () => {
      await restore();

      await waitFor(() => {
        expect(push).toHaveBeenCalledWith("/admin/content/test/editorial");
      });
    });

    it("uses the new version for the next restore", async () => {
      // Reusing the version the dialog opened with would conflict with the
      // restore it just performed.
      await restore();

      await waitFor(() => {
        expect(restoreContentRevisionAction).toHaveBeenCalledTimes(1);
      });

      fireEvent.click(
        (await screen.findAllByText("core.content.history.restore.action"))[0],
      );
      fireEvent.click(
        await screen.findByText("core.content.history.restore.confirm"),
      );

      await waitFor(() => {
        expect(restoreContentRevisionAction).toHaveBeenLastCalledWith(
          "test.editorial",
          7,
          1049,
          51,
        );
      });
    });
  });
});
