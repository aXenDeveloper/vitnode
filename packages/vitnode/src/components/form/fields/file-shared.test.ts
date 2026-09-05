import { describe, expect, it } from "vitest";

import type { AutoFormFileValue } from "./file-shared";

import { fileIdsOfFormValue, resolveFormFiles } from "./file-shared";

const file = (id: number, name = `photo-${id}.webp`): AutoFormFileValue => ({
  id,
  mimeType: "image/webp",
  name,
  size: 1024,
  url: `https://cdn.test/${id}.webp`,
});

describe("fileIdsOfFormValue", () => {
  it("reads a single identifier", () => {
    expect(fileIdsOfFormValue(7)).toEqual([7]);
  });

  it("reads a list, in the order it was given", () => {
    expect(fileIdsOfFormValue([9, 2, 5])).toEqual([9, 2, 5]);
  });

  it("treats every empty shape as no files", () => {
    // `null` is what Remove sends for a nullable column, `undefined` is a field
    // the form has not been given, and `[]` is an empty gallery.
    for (const value of [null, undefined, "", 0, -1, 1.5, {}, []]) {
      expect(fileIdsOfFormValue(value)).toEqual([]);
    }
  });

  it("drops rubbish out of a list rather than the whole list", () => {
    expect(fileIdsOfFormValue([7, null, "3", 0, 9])).toEqual([7, 9]);
  });
});

describe("resolveFormFiles", () => {
  it("describes what the value names", () => {
    expect(resolveFormFiles(7, [file(7)])).toEqual([{ file: file(7), id: 7 }]);
  });

  it("shows nothing for a value that names nothing", () => {
    // Remove sends `null`, and the control has to go back to its drop zone even
    // though the descriptor is still in the lookup.
    expect(resolveFormFiles(null, [file(7)])).toEqual([]);
  });

  it("brings the preview back when the value comes back", () => {
    // The reported bug, in one line: remove, abandon the form, and the record's
    // own identifier is what the control is handed again. Because the lookup is
    // independent of the value, the file describes itself once more - nothing
    // has to re-fetch, and nothing had to be kept in sync.
    const known = [file(7)];

    expect(resolveFormFiles(null, known)).toEqual([]);
    expect(resolveFormFiles(7, known)).toEqual([{ file: file(7), id: 7 }]);
  });

  it("keeps an identifier it cannot describe, rather than hiding it", () => {
    // "There is a file here and I cannot describe it" must not look like "there
    // is no file here": the second invites replacing something unseen.
    expect(resolveFormFiles(7, [])).toEqual([{ file: null, id: 7 }]);
  });

  it("orders a gallery by the value, not by the lookup", () => {
    // The value is the stored order. Sorting by anything else would show a
    // different gallery from the one that would be saved.
    expect(
      resolveFormFiles([9, 3, 7], [file(3), file(7), file(9)]).map(
        entry => entry.id,
      ),
    ).toEqual([9, 3, 7]);
  });

  it("lets a later descriptor win over an earlier one for the same id", () => {
    // The controls pass the row's own file first and this session's uploads
    // after, so re-uploading over an identifier shows what was just stored.
    const [entry] = resolveFormFiles(7, [
      file(7, "old.webp"),
      file(7, "new.webp"),
    ]);

    expect(entry.file?.name).toBe("new.webp");
  });

  it("ignores gaps in the lookup", () => {
    // `initialFile` is `undefined` while creating and `null` for a field holding
    // nothing, and both are spread into the lookup by the callers.
    expect(resolveFormFiles(7, [null, undefined, file(7)])).toEqual([
      { file: file(7), id: 7 },
    ]);
  });
});
