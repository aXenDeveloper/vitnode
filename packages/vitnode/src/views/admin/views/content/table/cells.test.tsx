import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ContentColumnSpec } from "@/content/admin/spec";

import { ContentCell, type ContentRowData } from "./cells";

vi.mock("next-intl", () => ({
  useFormatter: () => ({
    dateTime: (value: Date) => value.toISOString(),
    relativeTime: (value: Date) => value.toISOString(),
  }),
  useLocale: () => "en",
  useNow: () => new Date("2026-08-03T12:00:00.000Z"),
  useTranslations: () => (key: string) => key,
}));

const statusLabels = { draft: "Draft", published: "Published" };

const cell = (spec: ContentColumnSpec, row: Partial<ContentRowData>) =>
  render(
    <ContentCell
      emptyLabel="—"
      row={{ id: 1, labels: {}, ...row }}
      spec={spec}
      statusLabels={statusLabels}
    />,
  );

describe("ContentCell", () => {
  describe("the generated publication column", () => {
    const spec: ContentColumnSpec = {
      kind: "publication",
      label: "Status",
      name: "status",
    };

    it("renders a draft badge", () => {
      cell(spec, { status: "draft" });

      expect(screen.getByText("Draft")).toBeDefined();
      expect(screen.queryByText("Published")).toBeNull();
    });

    it("renders a published badge", () => {
      cell(spec, { status: "published" });

      expect(screen.getByText("Published")).toBeDefined();
    });

    // Before the publication kind existed this column fell through to
    // "system", which renders anything that is not `id` as a date.
    it("does not render the status as a date", () => {
      const { container } = cell(spec, { status: "published" });

      expect(container.querySelector("time")).toBeNull();
    });
  });

  it("still renders the system timestamps as dates", () => {
    const { container } = cell(
      { kind: "system", label: "Updated", name: "updatedAt" },
      { updatedAt: new Date("2026-08-03T10:00:00.000Z") },
    );

    expect(container.textContent).toContain("2026");
  });
});
