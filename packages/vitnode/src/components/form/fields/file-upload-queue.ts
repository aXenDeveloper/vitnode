import { createTaskPool } from "@/lib/task-pool";

import type {
  FileUploadAnchor,
  PlacedFileUpload,
  QueuedFileUpload,
} from "./file-order";
import type { AutoFormFileValue } from "./file-shared";

import { placeUploadedFile } from "./file-order";

export const FILE_UPLOAD_CONCURRENCY = 6;

export interface FileUploadOptions {
  onProgress: (fraction: number) => void;
  signal: AbortSignal;
}

export interface FailedFileUpload {
  error: unknown;
  file: File;
  order: number;
}

export type FileUploadProgressEntry = QueuedFileUpload & {
  progress: null | number;
};

export interface FileUploadQueueState {
  /** The identifier this run appends after - see {@link FileUploadAnchor}. */
  anchorId: FileUploadAnchor;
  failed: FailedFileUpload[];
  /** Waiting or in flight, in pick order. */
  pending: FileUploadProgressEntry[];
  /** Landed during this run, so the ones after them know where to go. */
  placed: PlacedFileUpload[];
}

/** Nothing queued and nothing anchored: what a control mounts holding. */
export const EMPTY_FILE_UPLOAD_QUEUE_STATE: FileUploadQueueState = {
  anchorId: null,
  failed: [],
  pending: [],
  placed: [],
};

export interface FileUploadQueue {
  cancel: (order: number) => void;
  dismiss: (order: number) => void;
  /** Queues a selection, in the order the person made it. */
  enqueue: (files: readonly File[]) => void;
  /** Uploads running right now. Never above the pool's ceiling. */
  readonly inFlight: number;
  retry: (order: number) => void;
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
  upload: (
    file: File,
    options: FileUploadOptions,
  ) => Promise<AutoFormFileValue>;
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
  const controllers = new Map<number, AbortController>();

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

  const isPending = (order: number) =>
    state.pending.some(entry => entry.order === order);

  const finish = (order: number, failure?: FailedFileUpload) => {
    active -= 1;
    setState({
      ...state,
      failed: failure ? [...state.failed, failure] : state.failed,
      pending: state.pending.filter(entry => entry.order !== order),
      ...(active === 0 ? { anchorId: null, placed: [] } : {}),
    });
  };

  const reportProgress = (order: number, fraction: number) => {
    const progress = Math.min(1, Math.max(0, fraction));
    const entry = state.pending.find(current => current.order === order);
    if (!entry || entry.progress === progress) return;

    setState({
      ...state,
      pending: state.pending.map(current =>
        current.order === order ? { ...current, progress } : current,
      ),
    });
  };

  const run = async (file: File, order: number) => {
    if (!isPending(order)) return;

    const controller = new AbortController();
    controllers.set(order, controller);

    let stored: AutoFormFileValue | undefined;
    let failure: unknown;
    let failed = false;
    try {
      stored = await upload(file, {
        onProgress: fraction => {
          reportProgress(order, fraction);
        },
        signal: controller.signal,
      });
    } catch (error) {
      failed = true;
      failure = error;
    } finally {
      controllers.delete(order);
    }

    if (controller.signal.aborted || !isPending(order)) return;

    if (failed || !stored) {
      onSettled({ error: failure, file });
      finish(order, { error: failure, file, order });

      return;
    }

    onSettled({ file, stored });
    place(order, stored);
    finish(order);
  };

  const enqueue = (files: readonly File[]) => {
    const chosen = [...files];
    if (chosen.length === 0) return;

    const isNewRun = active === 0;
    const slots = chosen.map(file => ({ file, order: nextOrder++ }));
    active += slots.length;

    setState({
      anchorId: isNewRun ? (ids().at(-1) ?? null) : state.anchorId,
      failed: state.failed,
      pending: [
        ...state.pending,
        ...slots.map(({ file, order }) => ({
          name: file.name,
          order,
          progress: null,
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
  };

  return {
    cancel: order => {
      if (!isPending(order)) return;

      controllers.get(order)?.abort();
      finish(order);
    },
    dismiss: order => {
      setState({
        ...state,
        failed: state.failed.filter(entry => entry.order !== order),
      });
    },
    enqueue,
    get inFlight() {
      return pool.inFlight;
    },
    retry: order => {
      const failure = state.failed.find(entry => entry.order === order);
      if (!failure) return;

      setState({
        ...state,
        failed: state.failed.filter(entry => entry.order !== order),
      });
      enqueue([failure.file]);
    },
    get state() {
      return state;
    },
  };
};
