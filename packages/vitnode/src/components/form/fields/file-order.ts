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

  order: number;
  size: number;
}

/** One row of a file collection: a stored file, or a slot still uploading. */
export type FileGalleryToken =
  { id: number; kind: "file" } | { kind: "pending"; order: number };

export type FileUploadAnchor = null | number;

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

export const removeFileId = (ids: readonly number[], id: number): number[] =>
  ids.filter(current => current !== id);

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
