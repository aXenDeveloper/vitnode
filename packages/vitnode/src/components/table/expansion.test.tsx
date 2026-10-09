// @vitest-environment jsdom
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ColumnDef, DataTableTMin } from "./data-table-content";
import type { ExpandableDataTable } from "./expansion";

import { ContentDataTable } from "./content";
import { DataTableNavigationProvider } from "./navigation";

interface Order extends DataTableTMin {
  id: number;
  items: string[];
  number: string;
}

const edges: Order[] = [
  { id: 1, items: ["Coffee beans"], number: "#1001" },
  { id: 2, items: [], number: "#1002" },
];

const columns: ColumnDef<Order>[] = [
  { accessorKey: "number", header: "Order" },
];

const renderTable = ({
  bulkActions,
  expandable,
}: {
  bulkActions?: React.ReactNode;
  expandable?: ExpandableDataTable<Order>;
} = {}) =>
  render(
    <DataTableNavigationProvider
      value={{ navigate: vi.fn(), searchParams: new URLSearchParams() }}
    >
      <ContentDataTable<Order>
        bulkActions={bulkActions}
        columns={columns}
        edges={edges}
        expandable={expandable}
        id="orders"
        order={{ defaultOrder: { column: "number", order: "asc" } }}
        pageInfo={{
          count: 2,
          currentPage: 1,
          endCursor: null,
          hasNextPage: false,
          hasPreviousPage: false,
          pageSize: 10,
          startCursor: null,
          totalCount: 2,
          totalPages: 1,
        }}
      />
    </DataTableNavigationProvider>,
  );

const renderItems = (row: Order) => (
  <ul>
    {row.items.map(item => (
      <li key={item}>{item}</li>
    ))}
  </ul>
);

const expandLabel = "core.global.data_table.expand_row";
const collapseLabel = "core.global.data_table.collapse_row";

describe("ContentDataTable expandable rows", () => {
  it("renders no toggle and no extra column without the prop", () => {
    renderTable();

    expect(screen.queryByRole("button", { name: expandLabel })).toBeNull();
    expect(screen.getAllByRole("columnheader")).toHaveLength(1);
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });

  it("shows and hides the detail when the toggle is pressed", async () => {
    renderTable({ expandable: { render: renderItems } });

    const [toggle] = screen.getAllByRole("button", { name: expandLabel });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Coffee beans")).toBeNull();

    fireEvent.click(toggle);

    expect(screen.getByText("Coffee beans")).toBeTruthy();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.getAttribute("aria-label")).toBe(collapseLabel);
    const region = screen.getByTestId("table-expanded-row");
    expect(toggle.getAttribute("aria-controls")).toBe(region.id);
    expect(region.closest("td")?.getAttribute("colspan")).toBe("2");

    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await waitFor(() => {
      expect(screen.queryByText("Coffee beans")).toBeNull();
    });
  });

  it("keeps several rows open at once", () => {
    renderTable({ expandable: { render: row => `Detail ${row.number}` } });

    for (const toggle of screen.getAllByRole("button", {
      name: expandLabel,
    })) {
      fireEvent.click(toggle);
    }

    expect(screen.getByText("Detail #1001")).toBeTruthy();
    expect(screen.getByText("Detail #1002")).toBeTruthy();
  });

  it("gives rows that cannot expand no toggle", () => {
    renderTable({
      expandable: {
        canExpand: row => row.items.length > 0,
        render: renderItems,
      },
    });

    const rows = screen.getAllByRole("row");
    expect(
      within(rows[1]).getByRole("button", { name: expandLabel }),
    ).toBeTruthy();
    expect(within(rows[2]).queryByRole("button")).toBeNull();
  });

  it("opens the rows listed in defaultExpanded", () => {
    renderTable({ expandable: { defaultExpanded: [1], render: renderItems } });

    expect(screen.getByText("Coffee beans")).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: collapseLabel })
        .getAttribute("aria-expanded"),
    ).toBe("true");
  });

  it("puts the toggle after the selection checkbox", () => {
    renderTable({
      bulkActions: <span>Bulk</span>,
      expandable: { render: renderItems },
    });

    const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell");
    expect(within(cells[0]).getByRole("checkbox")).toBeTruthy();
    expect(
      within(cells[1]).getByRole("button", { name: expandLabel }),
    ).toBeTruthy();
  });
});
