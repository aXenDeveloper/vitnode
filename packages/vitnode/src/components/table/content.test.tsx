import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { ColumnDef, DataTableTMin } from "./data-table-content";

import { ContentDataTable } from "./content";
import { DataTableNavigationProvider } from "./navigation";

vi.mock("use-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

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
