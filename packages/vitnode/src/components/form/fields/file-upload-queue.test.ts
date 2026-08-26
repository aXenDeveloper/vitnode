import { describe, expect, it } from "vitest";

import type { AutoFormFileValue } from "./file-shared";
import type { FileUploadQueueState } from "./file-upload-queue";

import { planFileGallery, removeFileId } from "./file-order";
import {
  createFileUploadQueue,
  FILE_UPLOAD_CONCURRENCY,
} from "./file-upload-queue";

/**
 * The concurrency bug this queue exists for, and the four shapes it takes.
 *
 * Ten files picked at once are ten requests, and they answer in whatever order
 * the network decides. Appending each one as it lands therefore stored the
 * *network's* order - which nobody chose, nobody can reproduce, and which
 * differs between two editors uploading the same ten photographs over different
 * connections.
 *
 * Nothing here waits on a clock. Every upload is a promise the test resolves by
 * hand, in the order the test wants, which is the only way "B answered before A"
 * is a fact rather than a race.
 */

interface Deferred {
  reject: (error: unknown) => void;
  resolve: (value: AutoFormFileValue) => void;
}

/** Lets every promise chain that is already settled run to the end. */
const flush = async () => {
  await new Promise<void>(resolve => {
    setTimeout(resolve, 0);
  });
};

const descriptor = (id: number, name: string): AutoFormFileValue => ({
  id,
  mimeType: "image/webp",
  name,
  size: 2048,
  url: `https://cdn.test/${id}.webp`,
});

/**
 * The control's half of the contract, without the control.
 *
 * `ids` is the form value, written the way `field.onChange` writes it, and read
 * back the way the component's ref reads it - which is the whole point: four
 * uploads landing in four different ticks each have to append to what the other
 * three already did.
 */
const harness = ({
  concurrency,
  ids: initial = [],
}: { concurrency?: number; ids?: number[] } = {}) => {
  let ids = [...initial];
  let peak = 0;
  const running = new Set<string>();
  const waiting = new Map<string, Deferred>();
  const failed: string[] = [];
  const stored: number[] = [];
  let state: FileUploadQueueState = { anchorId: null, pending: [], placed: [] };

  const queue = createFileUploadQueue({
    concurrency,
    ids: () => ids,
    onChange: next => {
      ids = next;
    },
    onSettled: result => {
      if (result.stored) stored.push(result.stored.id);
      else failed.push(result.file.name);
    },
    onStateChange: next => {
      state = next;
    },
    upload: async file => {
      running.add(file.name);
      peak = Math.max(peak, running.size);

      const settled = new Promise<AutoFormFileValue>((resolve, reject) => {
        waiting.set(file.name, { reject, resolve });
      });

      try {
        return await settled;
      } finally {
        running.delete(file.name);
      }
    },
  });

  return {
    /** Where the in-flight cards would be drawn right now. */
    get gallery() {
      return planFileGallery({
        anchorId: state.anchorId,
        ids,
        pending: state.pending,
        placed: state.placed,
      });
    },
    get failed() {
      return failed;
    },
    /** Takes one file out of the value, the way the Remove button does. */
    remove: (id: number) => {
      ids = removeFileId(ids, id);
    },
    /** Fails one upload, the way a refused format does. */
    reject: async (name: string) => {
      waiting.get(name)?.reject(new Error(`${name} was refused`));
      await flush();
    },
    /** Finishes one upload with the identifier the API would have stored. */
    resolve: async (name: string, id: number) => {
      waiting.get(name)?.resolve(descriptor(id, name));
      await flush();
    },
    get ids() {
      return ids;
    },
    get inFlight() {
      return queue.inFlight;
    },
    /** The most that were ever in flight at one moment. */
    get peak() {
      return peak;
    },
    /** Queues a selection, in the order the dialog listed it. */
    pick: async (...names: string[]) => {
      queue.enqueue(
        names.map(name => new File(["bytes"], name, { type: "image/webp" })),
      );
      await flush();
    },
    get running() {
      return [...running];
    },
    get state() {
      return state;
    },
    get stored() {
      return stored;
    },
  };
};

describe("createFileUploadQueue", () => {
  it("stores the order they were picked in, not the order they answered", async () => {
    const files = harness();
    await files.pick("A.webp", "B.webp", "C.webp");

    // The reported case: the smallest file wins the race, the largest loses it.
    await files.resolve("B.webp", 102);
    await files.resolve("C.webp", 103);
    await files.resolve("A.webp", 101);

    expect(files.ids).toEqual([101, 102, 103]);
  });

  it("appends a selection after the files the field already held", async () => {
    const files = harness({ ids: [10, 11] });
    await files.pick("A.webp", "B.webp");

    await files.resolve("B.webp", 102);
    await files.resolve("A.webp", 101);

    expect(files.ids).toEqual([10, 11, 101, 102]);
  });

  it("leaves no gap where an upload failed", async () => {
    const files = harness();
    await files.pick("A.webp", "B.webp", "C.webp");

    await files.resolve("A.webp", 101);
    await files.reject("B.webp");
    await files.resolve("C.webp", 103);

    // Two files, in the places they were picked in. Not three with a hole, and
    // not [C, A] because C answered while B was still being refused.
    expect(files.ids).toEqual([101, 103]);
    expect(files.failed).toEqual(["B.webp"]);
  });

  it("keeps an existing gallery, a refusal and the pick order all at once", async () => {
    // The three rules meeting in one selection, which is where the old version
    // came apart: two files already stored, three picked, one of the three
    // refused, and none of them answering in the order they were chosen.
    const files = harness({ ids: [8, 9] });
    await files.pick("A.webp", "B.webp", "C.webp");

    await files.resolve("B.webp", 102);
    await files.resolve("A.webp", 101);
    await files.reject("C.webp");

    expect(files.ids).toEqual([8, 9, 101, 102]);
    expect(files.failed).toEqual(["C.webp"]);
    // And the run is closed, so the next selection anchors itself afresh.
    expect(files.state).toEqual({ anchorId: null, pending: [], placed: [] });
  });

  it("keeps a second selection behind the first one", async () => {
    const files = harness({ ids: [9] });
    await files.pick("A.webp", "B.webp");
    // Chosen while the first pair is still going, which is what a person does
    // when they realise they missed two.
    await files.pick("C.webp", "D.webp");

    await files.resolve("D.webp", 104);
    await files.resolve("B.webp", 102);
    await files.resolve("C.webp", 103);
    await files.resolve("A.webp", 101);

    expect(files.ids).toEqual([9, 101, 102, 103, 104]);
  });

  it("anchors the next selection to wherever the list has got to", async () => {
    const files = harness();
    await files.pick("A.webp");
    await files.resolve("A.webp", 101);

    // The run is over, so the next one reads the list afresh - including a
    // reorder or a removal that happened in between.
    await files.pick("B.webp");
    await files.resolve("B.webp", 102);

    expect(files.ids).toEqual([101, 102]);
    expect(files.state).toEqual({ anchorId: null, pending: [], placed: [] });
  });

  it("does not add the same file twice", async () => {
    const files = harness();
    await files.pick("A.webp");
    await files.resolve("A.webp", 101);

    await files.pick("again.webp");
    await files.resolve("again.webp", 101);

    // The descriptor is still reported, because it is worth remembering; the
    // list is not made two long by one file.
    expect(files.ids).toEqual([101]);
    expect(files.stored).toEqual([101, 101]);
  });

  it("runs at most the pool's ceiling at once", async () => {
    const files = harness({ concurrency: 3 });
    await files.pick("a", "b", "c", "d", "e", "f", "g", "h");

    expect(files.running).toEqual(["a", "b", "c"]);
    expect(files.inFlight).toBe(3);

    // One slot frees, exactly one more starts - and it is the next one picked,
    // not whichever was cheapest.
    await files.resolve("b", 2);
    expect(files.running).toEqual(["a", "c", "d"]);

    await files.reject("a");
    // A failure frees its slot like anything else. A pool that stalled on one
    // would leave the other seven files queued behind a refused format.
    expect(files.running).toEqual(["c", "d", "e"]);

    for (const [at, name] of ["c", "d", "e", "f", "g", "h"].entries()) {
      await files.resolve(name, 10 + at);
    }

    expect(files.peak).toBe(3);
    expect(files.ids).toEqual([2, 10, 11, 12, 13, 14, 15]);
  });

  it("defaults to six at a time for a two-hundred-file field", async () => {
    const files = harness();
    await files.pick(...Array.from({ length: 200 }, (_, at) => `f-${at}`));

    expect(files.peak).toBe(FILE_UPLOAD_CONCURRENCY);
    expect(files.state.pending).toHaveLength(200);
  });

  it("draws every in-flight card where its file is going to land", async () => {
    const files = harness({ ids: [9] });
    await files.pick("A.webp", "B.webp", "C.webp");

    // Nothing has answered: the list already reads the way the dialog did.
    expect(
      files.gallery.map(token => ("id" in token ? token.id : token.order)),
    ).toEqual([9, 0, 1, 2]);

    await files.resolve("C.webp", 103);
    await files.resolve("A.webp", 101);

    // B is still going, and its skeleton is between the two that landed - not
    // under them, where it would jump a row the moment it finished.
    expect(files.gallery).toEqual([
      { id: 9, kind: "file" },
      { id: 101, kind: "file" },
      { kind: "pending", order: 1 },
      { id: 103, kind: "file" },
    ]);
  });

  it("keeps the rest of a selection in order when one is removed mid-upload", async () => {
    const files = harness();
    await files.pick("A.webp", "B.webp", "C.webp");

    await files.resolve("A.webp", 101);
    await files.resolve("B.webp", 102);
    // The person removes A while C is still uploading - the form value is the
    // source of truth, so the queue reads it back as it now stands.
    files.remove(101);
    await files.resolve("C.webp", 103);

    expect(files.ids).toEqual([102, 103]);
  });

  it("ignores an empty selection", async () => {
    const files = harness();
    await files.pick();

    expect(files.state.pending).toEqual([]);
    expect(files.inFlight).toBe(0);
  });
});
