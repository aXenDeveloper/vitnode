import { describe, expect, it } from "vitest";

import type { PlacedFileUpload, QueuedFileUpload } from "./file-order";

import {
  moveFileId,
  placeUploadedFile,
  planFileGallery,
  removeFileId,
} from "./file-order";

/**
 * The rule these three functions exist for: **a file's place is the place it was
 * picked in.**
 *
 * The version before them appended each upload as it settled, so a gallery of
 * ten stored the order the network happened to answer in - which nobody chose,
 * nobody can predict, and which changes between two editors uploading the same
 * ten files. Every case below is one half of that bug, or one of the two ways a
 * person is allowed to override it afterwards.
 */

const queued = (order: number, name = `photo-${order}`): QueuedFileUpload => ({
  name,
  order,
  size: 1024,
});

describe("placeUploadedFile", () => {
  /** The three files of the reported case, picked in this order. */
  const [a, b, c] = [
    { id: 101, order: 0 },
    { id: 102, order: 1 },
    { id: 103, order: 2 },
  ] satisfies PlacedFileUpload[];

  /** Lands `arrivals` one at a time, in the order given, onto `ids`. */
  const land = (
    ids: readonly number[],
    anchorId: null | number,
    arrivals: readonly PlacedFileUpload[],
  ): number[] => {
    let current = [...ids];
    const placed: PlacedFileUpload[] = [];

    for (const arrival of arrivals) {
      current = placeUploadedFile({
        anchorId,
        id: arrival.id,
        ids: current,
        order: arrival.order,
        placed,
      });
      placed.push(arrival);
    }

    return current;
  };

  it("stores the pick order however the uploads finish", () => {
    // B, then C, then A - a thumbnail beating a photograph, which is the normal
    // case rather than the unlucky one.
    expect(land([], null, [b, c, a])).toEqual([a.id, b.id, c.id]);
    expect(land([], null, [c, b, a])).toEqual([a.id, b.id, c.id]);
    expect(land([], null, [a, b, c])).toEqual([a.id, b.id, c.id]);
  });

  it("appends a selection after what the field already held", () => {
    // The anchor is the last identifier at pick time, so an edit form's existing
    // gallery is never opened up and inserted into.
    expect(land([9, 8], 8, [b, a])).toEqual([9, 8, a.id, b.id]);
  });

  it("closes over a file that failed rather than leaving its place", () => {
    // B never arrives. A and C keep the places they were picked in, and the list
    // is two long - not three with a hole, and not [C, A].
    expect(land([], null, [a, c])).toEqual([a.id, c.id]);
  });

  it("keeps a selection together when its anchor is removed mid-upload", () => {
    // The anchor is gone, so there is nothing left to append after but the end.
    expect(land([], 8, [b, a])).toEqual([a.id, b.id]);
  });

  it("follows the nearest sibling still in the list", () => {
    // A landed and was then removed before C arrived. C follows B, which is the
    // next place back that still exists - not the head of the list.
    const withA = placeUploadedFile({
      anchorId: 9,
      id: a.id,
      ids: [9],
      order: a.order,
      placed: [],
    });
    const withB = placeUploadedFile({
      anchorId: 9,
      id: b.id,
      ids: withA,
      order: b.order,
      placed: [a],
    });

    expect(withB).toEqual([9, a.id, b.id]);
    expect(
      placeUploadedFile({
        anchorId: 9,
        id: c.id,
        ids: removeFileId(withB, a.id),
        order: c.order,
        placed: [a, b],
      }),
    ).toEqual([9, b.id, c.id]);
  });

  it("does not add a file the list already holds", () => {
    // The same file picked twice in two selections is one entry. The API would
    // refuse the duplicate anyway; not adding it is the quieter answer.
    expect(
      placeUploadedFile({
        anchorId: null,
        id: a.id,
        ids: [a.id, b.id],
        order: 7,
        placed: [],
      }),
    ).toEqual([a.id, b.id]);
  });
});

describe("planFileGallery", () => {
  it("shows nothing but the files when nothing is uploading", () => {
    expect(
      planFileGallery({ anchorId: null, ids: [4, 7], pending: [], placed: [] }),
    ).toEqual([
      { id: 4, kind: "file" },
      { id: 7, kind: "file" },
    ]);
  });

  it("puts a running upload where it is going to land", () => {
    // A and C are stored, B is still in flight. Its skeleton belongs *between*
    // them: shown at the bottom it would jump two rows up the moment it
    // finished, under whatever the cursor was aiming at.
    expect(
      planFileGallery({
        anchorId: null,
        ids: [101, 103],
        pending: [queued(1)],
        placed: [
          { id: 101, order: 0 },
          { id: 103, order: 2 },
        ],
      }),
    ).toEqual([
      { id: 101, kind: "file" },
      { kind: "pending", order: 1 },
      { id: 103, kind: "file" },
    ]);
  });

  it("shows a whole selection in pick order before anything has answered", () => {
    // Nothing has landed. Each placeholder is a sibling for the next, so the
    // list reads the way the dialog did.
    expect(
      planFileGallery({
        anchorId: 9,
        ids: [9],
        pending: [queued(2), queued(0), queued(1)],
        placed: [],
      }),
    ).toEqual([
      { id: 9, kind: "file" },
      { kind: "pending", order: 0 },
      { kind: "pending", order: 1 },
      { kind: "pending", order: 2 },
    ]);
  });

  it("keeps a second selection behind the first", () => {
    // A and B are still going when C and D are chosen. The run keeps its anchor,
    // so the second pair queues behind the first rather than in front of it.
    expect(
      planFileGallery({
        anchorId: 9,
        ids: [9],
        pending: [queued(0), queued(1), queued(2), queued(3)],
        placed: [],
      }).map(token => (token.kind === "file" ? token.id : token.order)),
    ).toEqual([9, 0, 1, 2, 3]);
  });
});

describe("moveFileId", () => {
  it("drags a file in front of another", () => {
    // The reported gallery: the third image is the one that should lead.
    expect(moveFileId([1, 2, 3], 3, 1)).toEqual([3, 1, 2]);
  });

  it("drags a file down the list", () => {
    expect(moveFileId([1, 2, 3], 1, 3)).toEqual([2, 3, 1]);
  });

  it("leaves the list alone when nothing moved", () => {
    expect(moveFileId([1, 2, 3], 2, 2)).toEqual([1, 2, 3]);
    // A drop outside the list, which is what a cancelled drag reports.
    expect(moveFileId([1, 2, 3], 2, 99)).toEqual([1, 2, 3]);
  });
});

describe("removeFileId", () => {
  it("leaves the order of everything else exactly as it was", () => {
    expect(removeFileId([1, 2, 3, 4], 2)).toEqual([1, 3, 4]);
  });

  it("survives a reorder before it", () => {
    // The interaction the two have to get right together: rearrange, then take
    // one away, and what is left is still in the order it was put in.
    const reordered = moveFileId([1, 2, 3], 3, 1);

    expect(reordered).toEqual([3, 1, 2]);
    expect(removeFileId(reordered, 1)).toEqual([3, 2]);
  });

  it("does nothing for a file the list does not hold", () => {
    expect(removeFileId([1, 2], 9)).toEqual([1, 2]);
  });
});
