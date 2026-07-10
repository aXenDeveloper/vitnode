import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ColumnDef } from "./data-table";

import { DataTable } from "./data-table";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

interface DemoUser {
  email: string;
  id: number;
  name: string;
  status: string;
}

const edges: DemoUser[] = [
  { id: 1, name: "John Doe", email: "john@mail.com", status: "active" },
  { id: 2, name: "Jane Smith", email: "jane@mail.com", status: "banned" },
];

const pageInfo = {
  count: edges.length,
  endCursor: 2,
  hasNextPage: false,
  hasPreviousPage: false,
  startCursor: 1,
  totalCount: edges.length,
};

const renderTable = (columns: ColumnDef<DemoUser>[], data = edges) =>
  render(
    <DataTable
      columns={columns}
      edges={data}
      id="demo-table"
      order={{
        columns: ["name"],
        defaultOrder: { column: "name", order: "asc" },
      }}
      pageInfo={pageInfo}
    />,
  );

describe("DataTable columns", () => {
  it("renders headers and accessorKey values without a cell renderer", () => {
    renderTable([
      { accessorKey: "name", header: "Name" },
      { accessorKey: "email", header: "Email" },
    ]);

    expect(screen.getByText("Name")).toBeDefined();
    expect(screen.getByText("Email")).toBeDefined();
    expect(screen.getByText("John Doe")).toBeDefined();
    expect(screen.getByText("jane@mail.com")).toBeDefined();
  });

  it("renders custom cell output and passes row + allData", () => {
    const cell = vi.fn(
      ({ row, allData }: { allData: DemoUser[]; row: DemoUser }) => (
        <span>{`${row.name} of ${allData.length}`}</span>
      ),
    );

    renderTable([{ accessorKey: "name", header: "Name", cell }]);

    expect(screen.getByText("John Doe of 2")).toBeDefined();
    expect(cell).toHaveBeenCalledWith(
      expect.objectContaining({ allData: edges, row: edges[0] }),
    );
  });

  it("renders a display column via id + cell with no data binding", () => {
    renderTable([
      { accessorKey: "name", header: "Name" },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => <button type="button">edit-{row.id}</button>,
      },
    ]);

    expect(screen.getByRole("button", { name: "edit-1" })).toBeDefined();
    expect(screen.getByRole("button", { name: "edit-2" })).toBeDefined();
  });

  it("makes only columns listed in order.columns sortable", () => {
    renderTable([
      { accessorKey: "name", header: "Name" },
      { accessorKey: "email", header: "Email" },
    ]);

    // "name" is in order.columns -> rendered as a sort button.
    expect(screen.getByRole("button", { name: /Name/ })).toBeDefined();
    // "email" is not -> plain text, no button.
    expect(screen.queryByRole("button", { name: /Email/ })).toBeNull();
  });

  it("applies alignment classes to header and body cells", () => {
    renderTable([
      { accessorKey: "email", header: "Email", align: "center" },
      {
        id: "actions",
        header: "Actions",
        align: "right",
        cell: () => <span>action</span>,
      },
    ]);

    const centerHead = screen.getByText("Email");
    expect(centerHead.className).toContain("justify-center");

    const rightHead = screen.getByText("Actions");
    expect(rightHead.className).toContain("justify-end");

    const actionCell = screen.getAllByText("action")[0].closest("td");
    expect(actionCell?.className).toContain("justify-end");
  });

  it("renders the no-results state when there are no edges", () => {
    renderTable(
      [
        { accessorKey: "name", header: "Name" },
        { accessorKey: "email", header: "Email" },
      ],
      [],
    );

    expect(screen.getByText("no_results.title")).toBeDefined();
    expect(screen.queryByText("John Doe")).toBeNull();
  });

  it("does not render sort buttons in body rows", () => {
    renderTable([{ accessorKey: "name", header: "Name" }]);

    const johnCell = screen.getByText("John Doe").closest("td");
    expect(johnCell).not.toBeNull();
    expect(within(johnCell as HTMLElement).queryByRole("button")).toBeNull();
  });
});
