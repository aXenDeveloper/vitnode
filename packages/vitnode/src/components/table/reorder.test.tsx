import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ColumnDef, DataTableTMin } from "./data-table-content";
import type { ExpandableDataTable } from "./expansion";
import type { ReorderableDataTable } from "./reorder";

import { ContentDataTable } from "./content";
import { DataTableNavigationProvider } from "./navigation";
import { useRowOrderDataTable } from "./reorder";
import { isTableInStoredOrder, moveRowId } from "./reorder-state";

interface Task extends DataTableTMin {
  id: number;
  title: string;
}

const edges: Task[] = [
  { id: 1, title: "Write docs" },
  { id: 2, title: "Fix bug" },
  { id: 3, title: "Ship it" },
];

const columns: ColumnDef<Task>[] = [{ accessorKey: "title", header: "Task" }];

const handleLabel = "core.global.data_table.reorder_row";

const renderTable = ({
  bulkActions,
  expandable,
  reorderable,
  search = "",
}: {
  bulkActions?: React.ReactNode;
  expandable?: ExpandableDataTable<Task>;
  reorderable?: ReorderableDataTable<Task>;
  search?: string;
} = {}) =>
  render(
    <DataTableNavigationProvider
      value={{ navigate: vi.fn(), searchParams: new URLSearchParams(search) }}
    >
      <ContentDataTable<Task>
        bulkActions={bulkActions}
        columns={columns}
        edges={edges}
        expandable={expandable}
        filters={[{ id: "status", label: "Status", options: [] }]}
        id="tasks"
        order={{
          columns: ["title"],
          defaultOrder: { column: "id", order: "asc" },
        }}
        pageInfo={{
          count: 3,
          currentPage: 1,
          endCursor: null,
          hasNextPage: false,
          hasPreviousPage: false,
          pageSize: 10,
          startCursor: null,
          totalCount: 3,
          totalPages: 1,
        }}
        reorderable={reorderable}
      />
    </DataTableNavigationProvider>,
  );

const titles = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map(row => within(row).getAllByRole("cell").at(-1)?.textContent);

const stubRowGeometry = () => {
  const rowHeight = 40;

  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const group = this.closest("[data-slot=table-row-group]");
      const index = group?.parentElement
        ? [
            ...group.parentElement.querySelectorAll(
              ":scope > [data-slot=table-row-group]",
            ),
          ].indexOf(group)
        : -1;
      const top = index === -1 ? 0 : 40 + index * rowHeight;
      const height = index === -1 ? 1000 : rowHeight;

      return DOMRect.fromRect({ height, width: 600, x: 0, y: top });
    },
  );
};

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(Element.prototype, "animate");
});

describe("moveRowId", () => {
  it("moves a row down and reports where it came from and went", () => {
    expect(moveRowId([1, 2, 3, 4], 1, 3)).toEqual({
      activeId: 1,
      from: 0,
      ids: [2, 3, 1, 4],
      overId: 3,
      to: 2,
    });
  });

  it("moves a row up", () => {
    expect(moveRowId([1, 2, 3, 4], 4, 2)?.ids).toEqual([1, 4, 2, 3]);
  });

  it("returns null for a drop in place or an unknown id", () => {
    expect(moveRowId([1, 2, 3], 2, 2)).toBeNull();
    expect(moveRowId([1, 2, 3], 9, 2)).toBeNull();
    expect(moveRowId([1, 2, 3], 2, 9)).toBeNull();
  });

  it("does not mutate the ids it was given", () => {
    const ids = [1, 2, 3];
    moveRowId(ids, 1, 3);

    expect(ids).toEqual([1, 2, 3]);
  });
});

describe("isTableInStoredOrder", () => {
  const options = {
    defaultOrder: { column: "position", order: "asc" as const },
    filterIds: ["status"],
  };

  it("is true for the default view", () => {
    expect(isTableInStoredOrder(new URLSearchParams(), options)).toBe(true);
    expect(
      isTableInStoredOrder(
        new URLSearchParams("orderBy=position&order=asc&page=2"),
        options,
      ),
    ).toBe(true);
  });

  it("is false while searching, filtering or sorting by something else", () => {
    expect(
      isTableInStoredOrder(new URLSearchParams("search=bug"), options),
    ).toBe(false);
    expect(
      isTableInStoredOrder(new URLSearchParams("status=open"), options),
    ).toBe(false);
    expect(
      isTableInStoredOrder(new URLSearchParams("orderBy=title"), options),
    ).toBe(false);
    expect(
      isTableInStoredOrder(new URLSearchParams("order=desc"), options),
    ).toBe(false);
  });
});

describe("useRowOrderDataTable", () => {
  it("reorders right away and keeps the order when saving succeeds", async () => {
    const onReorder = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useRowOrderDataTable({ edges, onReorder }),
    );

    act(() => {
      result.current.reorder(1, 3);
    });

    expect(result.current.rows.map(row => row.id)).toEqual([2, 3, 1]);
    expect(onReorder).toHaveBeenCalledWith([2, 3, 1], {
      activeId: 1,
      from: 0,
      overId: 3,
      to: 2,
    });
    await waitFor(() => {
      expect(result.current.rows.map(row => row.id)).toEqual([2, 3, 1]);
    });
  });

  it("rolls back and shows an error toast when saving fails", async () => {
    const errorToast = vi.spyOn(toast, "error");
    const onReorder = vi.fn().mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() =>
      useRowOrderDataTable({ edges, onReorder }),
    );

    act(() => {
      result.current.reorder(3, 1);
    });

    expect(result.current.rows.map(row => row.id)).toEqual([3, 1, 2]);
    await waitFor(() => {
      expect(result.current.rows.map(row => row.id)).toEqual([1, 2, 3]);
    });
    expect(errorToast).toHaveBeenCalledWith(
      "core.global.data_table.reorder_failed",
      { description: "core.global.data_table.reorder_failed_desc" },
    );
  });

  it("goes back to the saved order when two overlapping drops both fail", async () => {
    const saves = [
      Promise.withResolvers<undefined>(),
      Promise.withResolvers<undefined>(),
    ];
    const onReorder = vi
      .fn()
      .mockReturnValueOnce(saves[0].promise)
      .mockReturnValueOnce(saves[1].promise);
    const { result } = renderHook(() =>
      useRowOrderDataTable({ edges, onReorder }),
    );

    act(() => {
      result.current.reorder(1, 3);
    });
    act(() => {
      result.current.reorder(2, 3);
    });
    expect(result.current.rows.map(row => row.id)).toEqual([3, 2, 1]);

    await act(async () => {
      saves[0].reject(new Error("offline"));
      await saves[0].promise.catch(() => undefined);
    });
    expect(result.current.rows.map(row => row.id)).toEqual([3, 2, 1]);

    await act(async () => {
      saves[1].reject(new Error("offline"));
      await saves[1].promise.catch(() => undefined);
    });
    expect(result.current.rows.map(row => row.id)).toEqual([1, 2, 3]);
  });

  it("keeps an earlier drop that is still saving when a later one fails", async () => {
    const saves = [
      Promise.withResolvers<undefined>(),
      Promise.withResolvers<undefined>(),
    ];
    const onReorder = vi
      .fn()
      .mockReturnValueOnce(saves[0].promise)
      .mockReturnValueOnce(saves[1].promise);
    const { result } = renderHook(() =>
      useRowOrderDataTable({ edges, onReorder }),
    );

    act(() => {
      result.current.reorder(1, 3);
    });
    act(() => {
      result.current.reorder(2, 3);
    });

    await act(async () => {
      saves[1].reject(new Error("offline"));
      await saves[1].promise.catch(() => undefined);
    });
    expect(result.current.rows.map(row => row.id)).toEqual([2, 3, 1]);

    await act(async () => {
      saves[0].resolve(undefined);
      await saves[0].promise;
    });
    expect(result.current.rows.map(row => row.id)).toEqual([2, 3, 1]);
  });

  it("follows the server again once it sends a new order", () => {
    const { rerender, result } = renderHook(
      ({ rows }) => useRowOrderDataTable({ edges: rows, onReorder: vi.fn() }),
      { initialProps: { rows: edges } },
    );

    act(() => {
      result.current.reorder(1, 2);
    });
    rerender({ rows: [edges[2], edges[0], edges[1]] });

    expect(result.current.rows.map(row => row.id)).toEqual([3, 1, 2]);
  });
});

describe("ContentDataTable reorderable rows", () => {
  it("renders no handle and no extra column without the prop", () => {
    renderTable();

    expect(screen.queryByRole("button", { name: handleLabel })).toBeNull();
    expect(screen.getAllByRole("columnheader")).toHaveLength(1);
  });

  it("gives every row a sortable handle in the first column", () => {
    renderTable({
      bulkActions: <span>Bulk</span>,
      reorderable: { getRowLabel: row => row.title, onReorder: vi.fn() },
    });

    const handles = screen.getAllByRole("button", { name: handleLabel });
    expect(handles).toHaveLength(3);
    expect(handles[0].getAttribute("aria-roledescription")).toBe("sortable");

    const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell");
    expect(within(cells[0]).getByRole("button")).toBe(handles[0]);
    expect(within(cells[1]).getByRole("checkbox")).toBeTruthy();
  });

  it("keeps an open detail panel in the group that moves with its row", () => {
    renderTable({
      expandable: { defaultExpanded: [2], render: row => `About ${row.title}` },
      reorderable: { onReorder: vi.fn() },
    });

    const detail = screen.getByText("About Fix bug");
    const group = detail.closest("[data-slot=table-row-group]");

    expect(group).not.toBeNull();
    expect(within(group as HTMLElement).getByText("Fix bug")).toBeTruthy();
  });

  it("locks the handles while the view is searched", () => {
    renderTable({
      reorderable: { onReorder: vi.fn() },
      search: "search=bug",
    });

    for (const handle of screen.getAllByRole("button", {
      name: handleLabel,
    })) {
      expect(handle.getAttribute("aria-disabled")).toBe("true");
    }
  });

  it("moves a row with the keyboard, saves the new order and settles it into place", async () => {
    stubRowGeometry();
    const animate = vi.fn();
    Object.defineProperty(Element.prototype, "animate", {
      configurable: true,
      value: animate,
    });
    const onReorder = vi.fn();
    renderTable({ reorderable: { onReorder } });

    const [first] = screen.getAllByRole("button", { name: handleLabel });
    first.focus();
    fireEvent.keyDown(first, { code: "Space", key: " " });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    fireEvent.keyDown(first, { code: "ArrowDown", key: "ArrowDown" });
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    fireEvent.keyDown(first, { code: "Space", key: " " });

    await waitFor(() => {
      expect(onReorder).toHaveBeenCalledWith([2, 1, 3], {
        activeId: 1,
        from: 0,
        overId: 2,
        to: 1,
      });
    });
    expect(titles()).toEqual(["Fix bug", "Write docs", "Ship it"]);
    expect(animate).toHaveBeenCalledWith(
      [
        { transform: "translate3d(0, -40px, 0)" },
        { transform: "translate3d(0, 0, 0)" },
      ],
      expect.objectContaining({ duration: 200 }),
    );
  });
});
