import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import React from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import messages from "@/locales/en.json";

import type { FileGalleryRow } from "./file-gallery";

import { FileGallery, fileGalleryDrop } from "./file-gallery";

/**
 * What a person is offered, which is a different question from what the value
 * holds.
 *
 * Two rules are asserted here and nowhere else, because both are about a control
 * being present or absent rather than about a number moving:
 *
 * - **`ordered: false` has no handles.** The API stores that collection by
 *   ascending `core_files.id`, so a handle would appear to set an order the save
 *   then quietly normalises away - a control that lies about what it does.
 * - **A file still uploading is not draggable.** It has no `core_files.id` to
 *   sort by and nothing to save; dragging it would be dragging something that
 *   does not exist yet.
 */

beforeAll(() => {
  // dnd-kit measures its droppables. jsdom has no ResizeObserver, and a missing
  // one is a thrown constructor rather than a degraded layout.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      disconnect() {}
      observe() {}
      unobserve() {}
    },
  );
});

const file = (id: number, name: string): FileGalleryRow => ({
  file: {
    id,
    mimeType: "image/webp",
    name,
    size: 4096,
    url: `https://cdn.test/${id}.webp`,
  },
  id,
  kind: "file",
});

const gallery = (
  props: Partial<React.ComponentProps<typeof FileGallery>> = {},
) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <FileGallery
        canRemove
        onRemove={() => undefined}
        onReorder={() => undefined}
        ordered
        rows={[
          file(101, "cover-1.webp"),
          file(102, "cover-2.webp"),
          file(103, "cover-3.webp"),
        ]}
        {...props}
      />
    </NextIntlClientProvider>,
  );

const handles = () => screen.queryAllByRole("button", { name: /^Reorder / });

describe("FileGallery", () => {
  it("gives every file its own named drag handle when the order is the author's", () => {
    gallery();

    expect(handles().map(handle => handle.getAttribute("aria-label"))).toEqual([
      "Reorder cover-1.webp",
      "Reorder cover-2.webp",
      "Reorder cover-3.webp",
    ]);
  });

  it("makes the handle reachable and describable from the keyboard", () => {
    gallery();
    const [handle] = handles();

    // A real button, so tab reaches it and space and enter both work - and
    // dnd-kit's own instructions are what it is described by, which is how a
    // screen reader learns that the arrow keys move it.
    expect(handle.tagName).toBe("BUTTON");
    expect(handle).toHaveProperty("type", "button");
    expect(handle.getAttribute("aria-roledescription")).toBe("sortable");
    expect(handle.getAttribute("aria-describedby")).toBeTruthy();
  });

  it("offers no reorder control at all when the field is not ordered", () => {
    gallery({ ordered: false });

    expect(handles()).toEqual([]);
    // The rest of the row is untouched: this is about ordering, not about
    // taking a file away.
    expect(screen.getAllByRole("button", { name: /^Remove / })).toHaveLength(3);
  });

  it("offers no reorder control for a single file", () => {
    // There is nowhere to drag it to, and a control that does nothing is worse
    // than no control.
    gallery({ rows: [file(101, "cover-1.webp")] });

    expect(handles()).toEqual([]);
  });

  it("does not let an upload still in flight be dragged", () => {
    gallery({
      rows: [
        file(101, "cover-1.webp"),
        { kind: "pending", name: "cover-2.webp", order: 4, size: 2048 },
        file(103, "cover-3.webp"),
      ],
    });

    // Two stored files, two handles. The card standing in for the third has
    // none, and it is not in the sortable set either.
    expect(handles().map(handle => handle.getAttribute("aria-label"))).toEqual([
      "Reorder cover-1.webp",
      "Reorder cover-3.webp",
    ]);

    const rows = screen.getAllByRole("listitem");
    expect(within(rows[1]).queryByRole("button")).toBeNull();
    expect(rows[1].textContent).toContain("Uploading");
  });

  it("names the file in every Remove button", () => {
    // "Remove file" nine times over says which file to nobody. A screen reader
    // reading the list of controls has to be able to tell them apart.
    gallery();

    expect(
      screen
        .getAllByRole("button", { name: /^Remove / })
        .map(button => button.getAttribute("aria-label")),
    ).toEqual([
      "Remove cover-1.webp",
      "Remove cover-2.webp",
      "Remove cover-3.webp",
    ]);
  });

  it("removes the file the button belongs to", () => {
    const onRemove = vi.fn();
    gallery({ onRemove });

    screen.getByRole("button", { name: "Remove cover-2.webp" }).click();

    expect(onRemove).toHaveBeenCalledWith(102);
  });

  it("refuses to remove below the field's minimum", () => {
    gallery({ canRemove: false });

    for (const button of screen.getAllByRole("button", { name: /^Remove / })) {
      expect(button).toHaveProperty("disabled", true);
    }
  });

  it("describes an identifier it has no descriptor for rather than hiding it", () => {
    // "There is a file here and I cannot describe it" must not look like "there
    // is no file here": the second invites replacing something unseen.
    gallery({ rows: [{ file: null, id: 101, kind: "file" }] });

    expect(screen.getByRole("listitem").textContent).toContain("Stored file");
    expect(
      screen.getByRole("button", { name: "Remove Stored file" }),
    ).toBeTruthy();
  });
});

describe("fileGalleryDrop", () => {
  const ids = [101, 102, 103];

  it("puts the file that was dragged where it was dropped", () => {
    // The third image dragged in front of the first. This is the whole of what a
    // drop changes, and it is the list the form is then handed.
    expect(
      fileGalleryDrop(ids, { active: { id: 103 }, over: { id: 101 } }),
    ).toEqual([103, 101, 102]);
  });

  it("drags a file down the list as readily as up it", () => {
    expect(
      fileGalleryDrop(ids, { active: { id: 101 }, over: { id: 103 } }),
    ).toEqual([102, 103, 101]);
  });

  it("writes nothing when the drop changed nothing", () => {
    // A cancelled drag, and a drop back onto the row it started from. Handing
    // the form an identical array would still mark it dirty, and still raise an
    // unsaved-changes prompt for an edit nobody made.
    expect(
      fileGalleryDrop(ids, { active: { id: 103 }, over: null }),
    ).toBeNull();
    expect(
      fileGalleryDrop(ids, { active: { id: 102 }, over: { id: 102 } }),
    ).toBeNull();
  });
});
