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
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  usePathname: () => "/admin/content/test/editorial",
  useRouter: () => ({ push }),
}));

let canRestore = true;
vi.mock("@/components/staff-permission/provider", () => ({
  useAdminStaffPermission: () => canRestore,
}));

const getContentRevisionAction = vi.fn();
const listContentRevisionsAction = vi.fn();
const restoreContentRevisionAction = vi.fn();
vi.mock("../mutation-api.server", () => ({
  getContentRevisionAction: (...args: unknown[]) =>
    getContentRevisionAction(...args),
  listContentRevisionsAction: (...args: unknown[]) =>
    listContentRevisionsAction(...args),
  restoreContentRevisionAction: (...args: unknown[]) =>
    restoreContentRevisionAction(...args),
}));

// The diff renderer has its own suite. Here the question is only *which*
// snapshots reach it, so it reports them and nothing else.
vi.mock("./revision-diff", () => ({
  RevisionDiff: ({
    after,
    before,
  }: {
    after: { version: number };
    before: null | { version: number };
  }) => (
    <span>{`diff ${before ? `v${before.version}` : "none"} → v${after.version}`}</span>
  ),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const { RevisionHistory } = await import("./revision-history");

const spec: ContentFormSpec = {
  contentTypeId: "test.editorial",
  defaultLocale: null,
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
  actorRoleColor: null,
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

/** The detail route, answering for whichever revision id it was asked about. */
const detailFor = (
  _contentTypeId: string,
  _id: number,
  revisionId: number,
) => ({
  revision: {
    ...revision(revisionId - 1000),
    snapshot: { version: revisionId - 1000 },
  },
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
  getContentRevisionAction.mockImplementation(
    async (...args: unknown[]) =>
      await Promise.resolve(detailFor(...(args as [string, number, number]))),
  );
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

  describe("the author", () => {
    it("links to their admin page", async () => {
      listContentRevisionsAction.mockResolvedValue(page([50]));

      view();

      const link = await screen.findByRole("link", { name: "Ada" });
      expect(link.getAttribute("href")).toBe("/admin/core/users/1");
    });

    it("is plain text for a system revision", async () => {
      listContentRevisionsAction.mockResolvedValue({
        edges: [
          {
            ...revision(50),
            actorName: null,
            actorType: "system" as const,
            actorUserId: null,
          },
        ],
        pageInfo: { endCursor: 50, hasNextPage: false },
      });

      view();

      expect(
        await screen.findByText("core.content.history.system_actor"),
      ).not.toBeNull();
      expect(screen.queryByRole("link")).toBeNull();
    });

    it("is plain text once their account is gone", async () => {
      // The revision keeps the id it was stamped with, and the join finds
      // nothing. A link to a user page that answers 404 is worse than no link.
      listContentRevisionsAction.mockResolvedValue({
        edges: [{ ...revision(50), actorName: null }],
        pageInfo: { endCursor: 50, hasNextPage: false },
      });

      view();

      expect(
        await screen.findByText("core.content.history.system_actor"),
      ).not.toBeNull();
      expect(screen.queryByRole("link")).toBeNull();
    });
  });

  it("says so rather than offering an empty panel when no field moved", async () => {
    // A publish moves no field value and the server records that, so the row
    // states the fact instead of inviting somebody to open a diff with nothing
    // in it - and to fetch two snapshots to find that out.
    listContentRevisionsAction.mockResolvedValue({
      edges: [{ ...revision(50), changedFields: [], operation: "publish" }],
      pageInfo: { endCursor: 50, hasNextPage: false },
    });

    view();

    expect(
      await screen.findByText("core.content.history.no_changes"),
    ).not.toBeNull();
    expect(screen.queryByText("core.content.history.show_changes")).toBeNull();
    expect(getContentRevisionAction).not.toHaveBeenCalled();
  });

  describe("the snapshot a row compares against", () => {
    const expand = async (version: number) => {
      const rows = await screen.findAllByText(
        "core.content.history.show_changes",
      );
      // Rows render newest first, so v50 is index 0.
      fireEvent.click(rows[50 - version]);
    };

    it("loads the snapshot only when the row is expanded", async () => {
      // A long article's every historical body, downloaded to render a list of
      // dates, is the thing this avoids.
      listContentRevisionsAction.mockResolvedValue(page([50, 49]));

      view();
      await screen.findByText("v50");

      expect(getContentRevisionAction).not.toHaveBeenCalled();
    });

    it("compares against the revision below it", async () => {
      listContentRevisionsAction.mockResolvedValue(page([50, 49]));

      view();
      await expand(50);

      expect(await screen.findByText("diff v49 → v50")).not.toBeNull();
    });

    it("has nothing to compare against at the end of a page", async () => {
      listContentRevisionsAction.mockResolvedValue(
        page([50, 49], { hasNextPage: true }),
      );

      view();
      await expand(49);

      expect(await screen.findByText("diff none → v49")).not.toBeNull();
    });

    it("fills that diff in once the next page arrives", async () => {
      // The boundary case. `previousId` goes from null to a real id while the
      // row is open, and the reader should not have to close and reopen it to
      // find out what actually changed.
      listContentRevisionsAction
        .mockResolvedValueOnce(page([50, 49], { hasNextPage: true }))
        .mockResolvedValueOnce(page([48, 47]));

      view();
      await expand(49);
      await screen.findByText("diff none → v49");

      fireEvent.click(screen.getByText("core.content.history.load_more"));

      expect(await screen.findByText("diff v48 → v49")).not.toBeNull();
    });

    it("keeps the row open while it does", async () => {
      listContentRevisionsAction
        .mockResolvedValueOnce(page([50, 49], { hasNextPage: true }))
        .mockResolvedValueOnce(page([48, 47]));

      view();
      await expand(49);
      await screen.findByText("diff none → v49");

      fireEvent.click(screen.getByText("core.content.history.load_more"));

      // Never replaced by a spinner: the snapshot it already has stays on
      // screen while the missing one is fetched behind it.
      await waitFor(() => {
        expect(screen.getByText("diff v48 → v49")).not.toBeNull();
      });
      expect(screen.queryByText("core.content.history.load_failed")).toBeNull();
    });

    it("does not re-fetch the snapshot it already has", async () => {
      listContentRevisionsAction
        .mockResolvedValueOnce(page([50, 49], { hasNextPage: true }))
        .mockResolvedValueOnce(page([48, 47]));

      view();
      await expand(49);
      await screen.findByText("diff none → v49");
      expect(getContentRevisionAction).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByText("core.content.history.load_more"));
      await screen.findByText("diff v48 → v49");

      // One more call, for the newly-available previous - not two.
      expect(getContentRevisionAction).toHaveBeenCalledTimes(2);
      expect(getContentRevisionAction).toHaveBeenLastCalledWith(
        "test.editorial",
        7,
        1048,
      );
    });

    it("does not fetch anything for a row that was never opened", async () => {
      listContentRevisionsAction
        .mockResolvedValueOnce(page([50, 49], { hasNextPage: true }))
        .mockResolvedValueOnce(page([48, 47]));

      view();
      fireEvent.click(
        await screen.findByText("core.content.history.load_more"),
      );
      await screen.findByText("v47");

      expect(getContentRevisionAction).not.toHaveBeenCalled();
    });
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
