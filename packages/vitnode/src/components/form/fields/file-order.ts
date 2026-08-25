/**
 * Where a file lands in a collection, decided by **when it was picked** rather
 * than when it uploaded.
 *
 * Ten files chosen at once are ten concurrent requests, and they finish in
 * whatever order the network hands back - a 40 KB thumbnail beats a 4 MB
 * photograph however they were listed in the dialog. Appending each one as it
 * settles therefore stores the network's order, which nobody chose and nobody
 * can predict, and a gallery whose first image changes depending on the wifi is
 * not a gallery anybody built.
 *
 * So every queued upload carries a **slot**: a number handed out at pick time,
 * monotonic across the whole session. The slot is what decides the position, and
 * these functions are the two halves of using it - one places a file that has
 * just landed, the other works out where the ones still in flight should be
 * *shown* while they are.
 *
 * All of it is pure, and none of it holds the list. `field.value` is the source
 * of truth (removing, reordering and resetting all happen there); a slot only
 * ever says where a new identifier joins it.
 */

import { arrayMove } from "@dnd-kit/sortable";

/** One upload that has landed: the slot it was queued in, and what it stored. */
export interface PlacedFileUpload {
  id: number;
  /** The pick position it was queued with. */
  order: number;
}

/** One upload still in flight, as the list has to show it. */
export interface QueuedFileUpload {
  name: string;
  /**
   * The pick position - and this card's React identity.
   *
   * Monotonic and never reused, so it is safe as a key: an array index would
   * make the second file inherit the first one's card the moment the first
   * settles, and a name would collide the moment somebody picks `photo.jpg`
   * from two folders.
   */
  order: number;
  size: number;
}

/** One row of a file collection: a stored file, or a slot still uploading. */
export type FileGalleryToken =
  { id: number; kind: "file" } | { kind: "pending"; order: number };

/**
 * The list a run of uploads appends *after*.
 *
 * An identifier rather than an index, because the list moves underneath a run -
 * a person can remove a file, or drag one to the front, while five uploads are
 * still going. `null` means the head of the list: the run began with nothing
 * before it.
 */
export type FileUploadAnchor = null | number;

/**
 * The index a slot belongs at, given what is already in the list.
 *
 * Four rules, in this order, and the first two are the same idea - **stay with
 * your siblings** - asked in decreasing order of confidence:
 *
 * 1. **Straight after its nearest earlier sibling.** The slot of the same run
 *    that was picked closest before this one and is still in the list. That is
 *    what makes B land between A and C whichever of the three finished first,
 *    and why removing A mid-upload does not send B to the front: the search
 *    walks back to the next sibling that is still there.
 * 2. **Straight before its nearest later sibling**, when nothing it was picked
 *    after has arrived yet. The first file of a selection is the one this
 *    happens to most often, and it has to get in front of the siblings that beat
 *    it rather than queue behind them.
 * 3. **Straight after the run's anchor**, when it has no sibling in the list at
 *    all: this is the selection's first arrival, so it goes where the selection
 *    goes. `null` is the head of the list.
 * 4. **The end**, when the anchor has since been removed - the only honest
 *    answer left once the place the run was heading for has gone.
 */
const indexForSlot = (
  tokens: readonly FileGalleryToken[],
  {
    anchorId,
    order,
    orderOf,
  }: {
    anchorId: FileUploadAnchor;
    order: number;
    /** The pick position of a row, when it belongs to this run. */
    orderOf: (token: FileGalleryToken) => number | undefined;
  },
): number => {
  let before = -1;
  let beforeOrder = -Infinity;
  let after = -1;
  let afterOrder = Infinity;

  tokens.forEach((token, index) => {
    const slot = orderOf(token);
    if (slot === undefined) return;

    if (slot < order && slot > beforeOrder) {
      before = index;
      beforeOrder = slot;
    }
    if (slot > order && slot < afterOrder) {
      after = index;
      afterOrder = slot;
    }
  });

  if (before !== -1) return before + 1;
  if (after !== -1) return after;
  if (anchorId === null) return 0;

  const anchor = tokens.findIndex(
    token => token.kind === "file" && token.id === anchorId,
  );

  return anchor === -1 ? tokens.length : anchor + 1;
};

/**
 * The identifiers, with one that has just finished uploading put in its place.
 *
 * The returned list is the new form value. A file already in it is returned
 * unchanged - the same file picked twice in two selections is one entry, which
 * is also what the API would decide, more slowly and after the bytes.
 */
export const placeUploadedFile = ({
  anchorId,
  id,
  ids,
  order,
  placed,
}: {
  anchorId: FileUploadAnchor;
  /** What the upload stored. */
  id: number;
  /** The identifiers the form holds right now. */
  ids: readonly number[];
  /** The slot this upload was queued in. */
  order: number;
  /** The run's earlier arrivals, so this one can follow the nearest of them. */
  placed: readonly PlacedFileUpload[];
}): number[] => {
  if (ids.includes(id)) return [...ids];

  const orders = new Map(placed.map(entry => [entry.id, entry.order]));
  const tokens = ids.map<FileGalleryToken>(current => ({
    id: current,
    kind: "file",
  }));
  const index = indexForSlot(tokens, {
    anchorId,
    order,
    orderOf: token =>
      token.kind === "file" ? orders.get(token.id) : undefined,
  });

  return [...ids.slice(0, index), id, ...ids.slice(index)];
};

/**
 * The rows to render: the stored files, with the in-flight ones interleaved
 * where they will land.
 *
 * A skeleton shown at the bottom and then re-appearing three rows up when its
 * upload finishes is the list rearranging itself under somebody's cursor. So the
 * placeholder is put where the file is going, by the same rule that will put the
 * file there - and the swap, when it comes, happens in place.
 *
 * Each placeholder counts as a sibling for the ones after it, so a selection of
 * ten renders in the order it was chosen even before a single request has
 * answered.
 */
export const planFileGallery = ({
  anchorId,
  ids,
  pending,
  placed,
}: {
  anchorId: FileUploadAnchor;
  /** The identifiers the form holds, in stored order. */
  ids: readonly number[];
  /** Uploads still in flight. */
  pending: readonly QueuedFileUpload[];
  /** Uploads of this run that have already landed. */
  placed: readonly PlacedFileUpload[];
}): FileGalleryToken[] => {
  let tokens = ids.map<FileGalleryToken>(id => ({ id, kind: "file" }));
  if (pending.length === 0) return tokens;

  const fileOrders = new Map(placed.map(entry => [entry.id, entry.order]));
  const queue = [...pending].sort((a, b) => a.order - b.order);

  for (const entry of queue) {
    const index = indexForSlot(tokens, {
      anchorId,
      order: entry.order,
      // A placeholder this loop has already put down is a sibling like any
      // other, which is what keeps a ten-file selection in pick order before a
      // single request has answered.
      orderOf: token =>
        token.kind === "file" ? fileOrders.get(token.id) : token.order,
    });

    tokens = [
      ...tokens.slice(0, index),
      { kind: "pending", order: entry.order },
      ...tokens.slice(index),
    ];
  }

  return tokens;
};

/**
 * The identifiers without one of them.
 *
 * A named function for a one-line filter because it is half of a pair: removing
 * and reordering are the only two things that touch a collection's order by
 * hand, and both have to leave everything they did not touch exactly where it
 * was. Removing B from `[A, B, C, D]` gives `[A, C, D]` and never `[A, D, C]`,
 * which is what a lookup-driven rebuild would quietly be free to do.
 */
export const removeFileId = (ids: readonly number[], id: number): number[] =>
  ids.filter(current => current !== id);

/**
 * The identifiers with one dragged in front of another.
 *
 * `arrayMove` from `@dnd-kit/sortable` rather than a hand-rolled splice, because
 * it is the same move the sortable list animated - anything else risks the list
 * settling somewhere other than where it was dropped.
 *
 * Returns the list unchanged when either end is not in it, which is what a drop
 * outside the list reports.
 */
export const moveFileId = (
  ids: readonly number[],
  activeId: number,
  overId: number,
): number[] => {
  const from = ids.indexOf(activeId);
  const to = ids.indexOf(overId);

  if (from === -1 || to === -1 || from === to) return [...ids];

  return arrayMove([...ids], from, to);
};
