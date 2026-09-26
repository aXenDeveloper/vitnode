import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ContentColumnSpec } from "@/content/admin/spec";

import type { ContentRowData } from "./cells";

import { ContentCell } from "./cells";

const COVER = {
  id: 7,
  mimeType: "image/webp",
  name: "cover-photo.webp",
  size: 2048,
  url: "https://cdn.example.com/cover-photo.webp",
};

const rowWith = (overrides: Partial<ContentRowData> = {}): ContentRowData => ({
  id: 1,
  labels: {},
  title: "Hello world",
  ...overrides,
});

const cell = (spec: ContentColumnSpec, row: ContentRowData) =>
  render(
    <ContentCell
      emptyLabel="—"
      row={row}
      spec={spec}
      statusLabels={{ draft: "Draft", published: "Published" }}
    />,
  );

const AUTHORS: ContentColumnSpec = {
  kind: "user",
  label: "Authors",
  multiple: true,
  name: "authors",
};

describe("ContentCell", () => {
  it("lists every author in order, formatted by role, without avatars", () => {
    const { container } = cell(
      AUTHORS,
      rowWith({
        references: {
          authors: [
            {
              label: "Bob",
              role: { color: "#ff0000", prefix: null },
              value: 5,
            },
            { label: "Ada", role: { color: null, prefix: null }, value: 3 },
          ],
        },
      }),
    );

    expect(
      screen.getAllByRole("listitem").map(item => item.textContent),
    ).toEqual(["Bob,", "Ada"]);
    expect(screen.getByText("Bob").parentElement?.style.color).toBe(
      "rgb(255, 0, 0)",
    );
    expect(screen.getByText("Ada").parentElement?.style.color).toBe("");
    expect(container.querySelector("img")).toBeNull();
  });

  it("shows the empty label for a record with no authors", () => {
    cell(AUTHORS, rowWith({ references: { authors: [] } }));

    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("lists to-many relations as badges", () => {
    cell(
      { kind: "relation", label: "Tags", multiple: true, name: "tags" },
      rowWith({
        references: {
          tags: [
            { color: "#123456", label: "News", value: 1 },
            { label: "Guides", value: 2 },
          ],
        },
      }),
    );

    expect(
      screen.getAllByRole("listitem").map(item => item.textContent),
    ).toEqual(["News", "Guides"]);
  });

  it("draws the thumbnail beside the title, without the file name", () => {
    const { container } = cell(
      { kind: "text", label: "Title", name: "title", thumbnail: "cover" },
      rowWith({ cover: 7, files: { cover: COVER } }),
    );

    expect(screen.getByText("Hello world")).toBeTruthy();
    expect(container.querySelector("img")?.getAttribute("src")).toBe(COVER.url);
    expect(screen.queryByText(COVER.name)).toBeNull();
  });

  it("keeps the title when the record has no thumbnail", () => {
    const { container } = cell(
      { kind: "text", label: "Title", name: "title", thumbnail: "cover" },
      rowWith({ cover: null, files: { cover: null } }),
    );

    expect(screen.getByText("Hello world")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });

  it("shows a localized column's resolved value", () => {
    cell(
      { kind: "text", label: "Title", localized: true, name: "title" },
      rowWith({
        localizedValues: { title: "English title" },
        title: undefined,
      }),
    );

    expect(screen.getByText("English title")).toBeTruthy();
  });

  it("shows the empty label when no language has the value", () => {
    cell(
      { kind: "text", label: "Title", localized: true, name: "title" },
      rowWith({ localizedValues: { title: null }, title: undefined }),
    );

    expect(screen.getByText("—")).toBeTruthy();
  });

  it("still names the file in a plain file column", () => {
    cell(
      { kind: "file", label: "Cover", name: "cover" },
      rowWith({ cover: 7, files: { cover: COVER } }),
    );

    expect(screen.getByText(COVER.name)).toBeTruthy();
  });
});
