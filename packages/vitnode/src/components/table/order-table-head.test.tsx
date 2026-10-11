import { act, fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { DataTableNavigationProvider, useDataTableUrl } from "./navigation";
import { OrderTableHeadDataTable } from "./order-table-head";

interface Row {
  createdAt: string;
  id: number;
  name: string;
}

const order = {
  defaultOrder: { column: "name" as const, order: "asc" as const },
};

const OtherControl = () => {
  const { navigate } = useDataTableUrl();

  return (
    <button
      onClick={() => {
        navigate("page=2");
      }}
      type="button"
    >
      Next page
    </button>
  );
};

const renderHeads = () => {
  const pending: (() => void)[] = [];
  const navigate = async () =>
    new Promise<void>(resolve => {
      pending.push(resolve);
    });

  render(
    <DataTableNavigationProvider
      value={{ navigate, searchParams: new URLSearchParams() }}
    >
      <OrderTableHeadDataTable<Row> id="name" order={order}>
        Name
      </OrderTableHeadDataTable>
      <OrderTableHeadDataTable<Row> id="createdAt" order={order}>
        Created
      </OrderTableHeadDataTable>
      <OtherControl />
    </DataTableNavigationProvider>,
  );

  return {
    settle: async () => {
      await act(async () => {
        for (const resolve of pending) resolve();
        await Promise.resolve();
      });
    },
  };
};

const spinnerIn = (column: string) =>
  within(screen.getByTestId(`table-order-${column}`)).queryByRole("status");

describe("OrderTableHeadDataTable", () => {
  it("shows the pending state only on the column that was clicked", async () => {
    const { settle } = renderHeads();

    await act(async () => {
      fireEvent.click(screen.getByTestId("table-order-createdAt"));
      await Promise.resolve();
    });

    expect(spinnerIn("createdAt")).not.toBeNull();
    expect(spinnerIn("name")).toBeNull();

    await settle();

    expect(spinnerIn("createdAt")).toBeNull();
  });

  it("keeps every header still while another control navigates", async () => {
    const { settle } = renderHeads();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Next page" }));
      await Promise.resolve();
    });

    expect(spinnerIn("name")).toBeNull();
    expect(spinnerIn("createdAt")).toBeNull();

    await settle();
  });
});
