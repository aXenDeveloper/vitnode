import { createTaskPool } from "@/lib/task-pool";

import type {
  FileUploadAnchor,
  PlacedFileUpload,
  QueuedFileUpload,
} from "./file-order";
import type { AutoFormFileValue } from "./file-shared";

import { placeUploadedFile } from "./file-order";

export const FILE_UPLOAD_CONCURRENCY = 6;

export interface FileUploadQueueState {
  /** The identifier this run appends after - see {@link FileUploadAnchor}. */
  anchorId: FileUploadAnchor;
  /** Waiting or in flight, in pick order. */
  pending: QueuedFileUpload[];
  /** Landed during this run, so the ones after them know where to go. */
  placed: PlacedFileUpload[];
}

/** Nothing queued and nothing anchored: what a control mounts holding. */
export const EMPTY_FILE_UPLOAD_QUEUE_STATE: FileUploadQueueState = {
  anchorId: null,
  pending: [],
  placed: [],
};

export interface FileUploadQueue {
  /** Queues a selection, in the order the person made it. */
  enqueue: (files: readonly File[]) => void;
  /** Uploads running right now. Never above the pool's ceiling. */
  readonly inFlight: number;
  readonly state: FileUploadQueueState;
}

export interface FileUploadQueueOptions {
  concurrency?: number;
  /** Reads the identifiers the form holds right now. */
  ids: () => readonly number[];
  /** Writes a new identifier list to the form. */
  onChange: (ids: number[]) => void;

  onSettled: (result: {
    error?: unknown;
    file: File;
    stored?: AutoFormFileValue;
  }) => void;
  /** The queue changed - re-render. */
  onStateChange: (state: FileUploadQueueState) => void;
  /** Sends one file and comes back with its descriptor. */
  upload: (file: File) => Promise<AutoFormFileValue>;
}

export const createFileUploadQueue = ({
  concurrency = FILE_UPLOAD_CONCURRENCY,
  ids,
  onChange,
  onSettled,
  onStateChange,
  upload,
}: FileUploadQueueOptions): FileUploadQueue => {
  const pool = createTaskPool(concurrency);
  let state = EMPTY_FILE_UPLOAD_QUEUE_STATE;
  // Waiting *and* in flight: the run is over only when the last one settles.
  let active = 0;
  let nextOrder = 0;

  const setState = (next: FileUploadQueueState) => {
    state = next;
    onStateChange(state);
  };

  const place = (order: number, stored: AutoFormFileValue) => {
    const current = ids();
    const next = placeUploadedFile({
      anchorId: state.anchorId,
      id: stored.id,
      ids: current,
      order,
      placed: state.placed,
    });

    // Recorded whether or not it joined the list: a duplicate is still a slot
    // its later siblings should follow, and forgetting it would send the next
    // arrival back to the anchor.
    setState({ ...state, placed: [...state.placed, { id: stored.id, order }] });

    if (!current.includes(stored.id)) onChange(next);
  };

  const run = async (file: File, order: number) => {
    try {
      const stored = await upload(file);
      // The descriptor first, so the card that replaces the placeholder can
      // describe itself in the same render the identifier arrives in.
      onSettled({ file, stored });
      place(order, stored);
    } catch (error) {
      onSettled({ error, file });
    } finally {
      active -= 1;
      setState({
        ...state,
        pending: state.pending.filter(entry => entry.order !== order),
        // The run is over. The next selection reads the list as it stands then,
        // which may be nothing like the one this run started against.
        ...(active === 0 ? { anchorId: null, placed: [] } : {}),
      });
    }
  };

  return {
    enqueue: files => {
      const chosen = [...files];
      if (chosen.length === 0) return;

      const isNewRun = active === 0;
      const slots = chosen.map(file => ({ file, order: nextOrder++ }));
      active += slots.length;

      setState({
        anchorId: isNewRun ? (ids().at(-1) ?? null) : state.anchorId,
        pending: [
          ...state.pending,
          ...slots.map(({ file, order }) => ({
            name: file.name,
            order,
            size: file.size,
          })),
        ],
        placed: isNewRun ? [] : state.placed,
      });

      for (const { file, order } of slots) {
        pool.add(async () => {
          await run(file, order);
        });
      }
    },
    get inFlight() {
      return pool.inFlight;
    },
    get state() {
      return state;
    },
  };
};
