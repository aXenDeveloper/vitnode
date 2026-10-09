// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { ColumnDef, DataTableTMin } from "./data-table-content";

import { ContentDataTable } from "./content";
import { DataTableNavigationProvider } from "./navigation";

interface TestItem extends DataTableTMin {
  action?: string;
  id: number;
  name: string;
}

const mockPageInfo = {
  count: 1,
  currentPage: 1,
  endCursor: null,
  hasNextPage: false,
  hasPreviousPage: false,
  pageSize: 10,
  startCursor: null,
  totalCount: 1,
  totalPages: 1,
};

const mockOrder = {
  columns: ["name" as const],
  defaultOrder: {
    column: "name" as const,
    order: "asc" as const,
  },
};

describe("ContentDataTable clickable rows", () => {
  const columns: ColumnDef<TestItem>[] = [
    {
      accessorKey: "name",
      header: "Name",
    },
    {
      cell: () => (
        <div>
          <button type="button">Edit</button>
          <a href="#test">Link</a>
          <input aria-label="Check item" type="checkbox" />
        </div>
      ),
      header: "Actions",
      id: "actions",
    },
  ];

  const edges: TestItem[] = [{ id: 1, name: "Item 1" }];

  const renderTable = ({
    rowOpens,
  }: {
    rowOpens?: (row: TestItem) => void;
  } = {}) => {
    return render(
      <DataTableNavigationProvider
        value={{
          navigate: vi.fn(),
          searchParams: new URLSearchParams(),
        }}
      >
        <ContentDataTable<TestItem>
          columns={columns}
          edges={edges}
          id="test-table"
          order={mockOrder}
          pageInfo={mockPageInfo}
          rowOpens={rowOpens}
        />
      </DataTableNavigationProvider>,
    );
  };

  it("sets tabIndex=0 when rowOpens is provided", () => {
    const rowOpens = vi.fn();
    renderTable({ rowOpens });

    const row = screen.getByRole("row", { name: /Item 1/i });
    expect(row.getAttribute("tabindex")).toBe("0");
  });

  it("does not set tabIndex when rowOpens is undefined", () => {
    renderTable();

    const row = screen.getByRole("row", { name: /Item 1/i });
    expect(row.getAttribute("tabindex")).toBeNull();
  });

  it("calls rowOpens on Enter key press", () => {
    const rowOpens = vi.fn();
    renderTable({ rowOpens });

    const row = screen.getByRole("row", { name: /Item 1/i });
    fireEvent.keyDown(row, { key: "Enter" });

    expect(rowOpens).toHaveBeenCalledTimes(1);
    expect(rowOpens).toHaveBeenCalledWith(edges[0]);
  });

  it("calls rowOpens and prevents default on Space key press", () => {
    const rowOpens = vi.fn();
    renderTable({ rowOpens });

    const row = screen.getByRole("row", { name: /Item 1/i });
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: " ",
    });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");
    row.dispatchEvent(event);

    expect(rowOpens).toHaveBeenCalledTimes(1);
    expect(rowOpens).toHaveBeenCalledWith(edges[0]);
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it("does not call rowOpens on other key presses", () => {
    const rowOpens = vi.fn();
    renderTable({ rowOpens });

    const row = screen.getByRole("row", { name: /Item 1/i });
    fireEvent.keyDown(row, { key: "ArrowDown" });
    fireEvent.keyDown(row, { key: "Tab" });

    expect(rowOpens).not.toHaveBeenCalled();
  });

  it("does not trigger rowOpens when Enter or Space is pressed on an interactive child control", () => {
    const rowOpens = vi.fn();
    renderTable({ rowOpens });

    const button = screen.getByRole("button", { name: "Edit" });
    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.keyDown(button, { key: " " });

    const link = screen.getByRole("link", { name: "Link" });
    fireEvent.keyDown(link, { key: "Enter" });

    const checkbox = screen.getByRole("checkbox", { name: "Check item" });
    fireEvent.keyDown(checkbox, { key: " " });

    expect(rowOpens).not.toHaveBeenCalled();
  });

  it("calls rowOpens on row click", () => {
    const rowOpens = vi.fn();
    renderTable({ rowOpens });

    const cell = screen.getByText("Item 1");
    fireEvent.click(cell);

    expect(rowOpens).toHaveBeenCalledTimes(1);
    expect(rowOpens).toHaveBeenCalledWith(edges[0]);
  });

  it("does not call rowOpens when interactive child control is clicked", () => {
    const rowOpens = vi.fn();
    renderTable({ rowOpens });

    const button = screen.getByRole("button", { name: "Edit" });
    fireEvent.click(button);

    expect(rowOpens).not.toHaveBeenCalled();
  });
});

describe("ContentDataTable custom rows and groups", () => {
  interface Plugin extends DataTableTMin {
    category: string;
    name: string;
  }

  const plugins: Plugin[] = [
    { category: "Content", id: 1, name: "Blog" },
    { category: "Community", id: 2, name: "Forum" },
    { category: "Content", id: 3, name: "Wiki" },
  ];

  const renderList = (
    props: Partial<React.ComponentProps<typeof ContentDataTable<Plugin>>>,
  ) =>
    render(
      <DataTableNavigationProvider
        value={{ navigate: vi.fn(), searchParams: new URLSearchParams() }}
      >
        <ContentDataTable<Plugin>
          edges={plugins}
          id="plugins"
          order={{ defaultOrder: { column: "name", order: "asc" } }}
          pageInfo={{ ...mockPageInfo, count: 3, totalCount: 3 }}
          renderRow={({ row }) => <article>{row.name} card</article>}
          {...props}
        />
      </DataTableNavigationProvider>,
    );

  it("renders each row through renderRow without a column header", () => {
    renderList({});

    expect(screen.getByText("Blog card")).toBeTruthy();
    expect(screen.queryAllByRole("columnheader")).toHaveLength(0);
  });

  it("keeps the select-all header when custom rows are selectable", () => {
    renderList({ bulkActions: <button type="button">Delete</button> });

    expect(screen.getAllByRole("columnheader").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("checkbox").length).toBe(plugins.length + 1);
  });

  it("puts rows under a heading for their group, in first-seen order", () => {
    renderList({
      groupBy: {
        key: row => row.category,
        label: group => `${group.key} plugins`,
      },
    });

    const groups = screen
      .getAllByRole("rowgroup")
      .filter(group => within(group).queryByRole("rowheader"));
    expect(groups).toHaveLength(2);
    expect(within(groups[0]).getByText("Content plugins")).toBeTruthy();
    expect(within(groups[0]).getByText("Blog card")).toBeTruthy();
    expect(within(groups[0]).getByText("Wiki card")).toBeTruthy();
    expect(within(groups[0]).getByText("2")).toBeTruthy();
    expect(within(groups[1]).getByText("Forum card")).toBeTruthy();
  });

  it("groups regular column rows too", () => {
    renderList({
      columns: [{ accessorKey: "name", header: "Name" }],
      groupBy: { key: row => row.category },
      renderRow: undefined,
    });

    expect(screen.getByRole("columnheader", { name: "Name" })).toBeTruthy();
    expect(screen.getByRole("rowheader", { name: /Community/ })).toBeTruthy();
  });
});
