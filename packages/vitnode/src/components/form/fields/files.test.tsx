import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import React from "react";
import {
  type FieldValues,
  FormProvider,
  useForm,
  type UseFormReturn,
} from "react-hook-form";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { FormField } from "@/components/ui/form";
import messages from "@/locales/en.json";

import type { AutoFormFileValue } from "./file-shared";

import { AutoFormFiles } from "./files";

/**
 * The control end to end: a selection goes in, requests come back out of order,
 * and `field.value` is the order the person picked.
 *
 * The pieces below it are tested on their own - the queue against deferred
 * promises, the gallery against what it renders - and this is the wiring, which
 * is the part that used to be wrong: `onSuccess` appended to the value it could
 * see, so whichever upload settled last decided where it went.
 *
 * Nothing here waits on a clock. Every upload is a promise the test resolves by
 * hand, in the order the test wants.
 */

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      disconnect() {}
      observe() {}
      unobserve() {}
    },
  );
});

/**
 * Runs one interaction and lets everything it started settle.
 *
 * The extra tick matters: an upload resolving is a promise chain - the queue
 * places the identifier, the form takes it, the list re-renders - and asserting
 * before it has run would be asserting on a half-finished render.
 */
const settled = async (interaction: () => void) => {
  await act(async () => {
    interaction();
    await Promise.resolve();
  });
};

const descriptor = (id: number, name: string): AutoFormFileValue => ({
  id,
  mimeType: "image/webp",
  name,
  size: 4096,
  url: `https://cdn.test/${id}.webp`,
});

const field = (
  props: {
    files?: AutoFormFileValue[];
    ids?: number[];
    ordered?: boolean;
  } = {},
) => {
  const settle = new Map<
    string,
    { reject: (error: unknown) => void; resolve: (id: number) => void }
  >();
  let running = 0;
  let peak = 0;
  const values: { gallery: number[] } = { gallery: props.ids ?? [] };
  let control: null | UseFormReturn = null;

  // Widened deliberately, so the form infers `FieldValues` rather than
  // `{ gallery: number[] }`. `AutoFormFiles` takes the `FieldValues` field every
  // `AutoForm` control takes, and a narrower form here would be asserting
  // against a contract the component does not have.
  const defaults: FieldValues = { gallery: props.ids ?? [] };

  const Harness = () => {
    const form = useForm({ defaultValues: defaults });
    control = form;
    // No retries anywhere: an upload is not idempotent, and a suite that
    // retried would answer a different question from the component.
    const [client] = React.useState(
      () =>
        new QueryClient({
          defaultOptions: { mutations: { retry: false } },
        }),
    );

    return (
      <NextIntlClientProvider locale="en" messages={messages}>
        <QueryClientProvider client={client}>
          <FormProvider {...form}>
            <FormField
              control={form.control}
              name="gallery"
              render={({ field: controlled }) => {
                values.gallery = controlled.value ?? [];

                return (
                  <AutoFormFiles
                    field={controlled}
                    files={props.files}
                    label="Gallery"
                    maxBytes={5 * 1024 * 1024}
                    maxItems={12}
                    onUpload={async file => {
                      running += 1;
                      peak = Math.max(peak, running);

                      try {
                        return await new Promise<AutoFormFileValue>(
                          (resolve, reject) => {
                            settle.set(file.name, {
                              reject,
                              resolve: id => {
                                resolve(descriptor(id, file.name));
                              },
                            });
                          },
                        );
                      } finally {
                        running -= 1;
                      }
                    }}
                    ordered={props.ordered ?? true}
                    otherProps={{}}
                  />
                );
              }}
            />
          </FormProvider>
        </QueryClientProvider>
      </NextIntlClientProvider>
    );
  };

  render(<Harness />);

  return {
    /** The form itself, for the paths that put a value back from outside. */
    get form() {
      if (!control) throw new Error("not rendered");

      return control;
    },
    get gallery() {
      return values.gallery;
    },
    get peak() {
      return peak;
    },
    /** Chooses files, exactly as the hidden `<input type="file">` reports them. */
    pick: async (...names: string[]) => {
      const input =
        document.querySelector<HTMLInputElement>('input[type="file"]');
      if (!input) throw new Error("no file input");

      Object.defineProperty(input, "files", {
        configurable: true,
        value: names.map(
          name => new File(["bytes"], name, { type: "image/webp" }),
        ),
      });

      await settled(() => {
        fireEvent.change(input);
      });
    },
    /** Refuses one upload, the way the API refuses a format. */
    reject: async (name: string, message: string) => {
      await settled(() => {
        settle.get(name)?.reject(new Error(message));
      });
    },
    /** Finishes one upload with the identifier the API would have stored. */
    resolve: async (name: string, id: number) => {
      await settled(() => {
        settle.get(name)?.resolve(id);
      });
    },
  };
};

/** The list as a person reads it, top to bottom. */
const rendered = () =>
  screen
    .queryAllByRole("listitem")
    .map(row => row.querySelector("[data-slot=attachment-title]")?.textContent);

describe("AutoFormFiles", () => {
  it("submits the order they were picked in, not the order they answered", async () => {
    const gallery = field();
    await gallery.pick("A.webp", "B.webp", "C.webp");

    await gallery.resolve("B.webp", 102);
    await gallery.resolve("C.webp", 103);
    await gallery.resolve("A.webp", 101);

    expect(gallery.gallery).toEqual([101, 102, 103]);
    expect(rendered()).toEqual(["A.webp", "B.webp", "C.webp"]);
  });

  it("appends a selection after the files the field already held", async () => {
    const gallery = field({
      files: [descriptor(10, "X.webp"), descriptor(11, "Y.webp")],
      ids: [10, 11],
    });
    await gallery.pick("A.webp", "B.webp");

    await gallery.resolve("B.webp", 102);
    await gallery.resolve("A.webp", 101);

    expect(gallery.gallery).toEqual([10, 11, 101, 102]);
  });

  it("leaves no gap where an upload was refused, and says which one", async () => {
    const gallery = field();
    await gallery.pick("A.webp", "B.webp", "C.webp");

    await gallery.resolve("A.webp", 101);
    await gallery.reject("B.webp", "Invalid or corrupt image file");
    await gallery.resolve("C.webp", 103);

    expect(gallery.gallery).toEqual([101, 103]);
    // Named, because a selection of three produces up to three of these and an
    // unattributed sentence names none of them - and the server's own words,
    // because "please try again" is how somebody retries a broken file forever.
    expect(
      screen.getByText("B.webp: Invalid or corrupt image file"),
    ).toBeTruthy();
  });

  it("keeps a second selection behind the first one", async () => {
    const gallery = field({ files: [descriptor(9, "X.webp")], ids: [9] });
    await gallery.pick("A.webp", "B.webp");
    // Chosen while the first pair is still going, which is what somebody does
    // when they realise they missed two.
    await gallery.pick("C.webp", "D.webp");

    await gallery.resolve("D.webp", 104);
    await gallery.resolve("B.webp", 102);
    await gallery.resolve("C.webp", 103);
    await gallery.resolve("A.webp", 101);

    expect(gallery.gallery).toEqual([9, 101, 102, 103, 104]);
  });

  it("uploads no more than the ceiling at once", async () => {
    const gallery = field();
    await gallery.pick(
      ...Array.from({ length: 12 }, (_, at) => `photo-${at}.webp`),
    );

    expect(gallery.peak).toBe(6);
  });

  it("shows each running upload where its file is going to land", async () => {
    const gallery = field();
    await gallery.pick("A.webp", "B.webp", "C.webp");

    // Before anything has answered, the list already reads the way the dialog
    // did - three cards with skeletons for the thumbnails that do not exist yet.
    expect(rendered()).toEqual(["A.webp", "B.webp", "C.webp"]);

    await gallery.resolve("C.webp", 103);
    await gallery.resolve("A.webp", 101);

    // B is still going and its card has not moved: what replaces it will be
    // dropped into the same row rather than arriving under the cursor.
    expect(rendered()).toEqual(["A.webp", "B.webp", "C.webp"]);
    expect(gallery.gallery).toEqual([101, 103]);
  });

  it("removes a file without disturbing the order of the rest", async () => {
    const gallery = field();
    await gallery.pick("A.webp", "B.webp", "C.webp");
    await gallery.resolve("A.webp", 101);
    await gallery.resolve("B.webp", 102);
    await gallery.resolve("C.webp", 103);

    await settled(() => {
      screen.getByRole("button", { name: "Remove B.webp" }).click();
    });

    expect(gallery.gallery).toEqual([101, 103]);
    expect(rendered()).toEqual(["A.webp", "C.webp"]);
  });

  it("follows the value wherever it is put, including back", async () => {
    // The reason the gallery is derived from `field.value` rather than held
    // beside it. A drag writes the new order to the form and nothing else, so a
    // reset - a dialog reopened, a save rolled back, a row replaced by a refresh
    // - puts the old order back and the list follows, without a reload and
    // without anything having to re-sync.
    const gallery = field();
    await gallery.pick("A.webp", "B.webp", "C.webp");
    await gallery.resolve("A.webp", 101);
    await gallery.resolve("B.webp", 102);
    await gallery.resolve("C.webp", 103);

    expect(rendered()).toEqual(["A.webp", "B.webp", "C.webp"]);

    await settled(() => {
      gallery.form.setValue("gallery", [103, 101, 102]);
    });
    expect(rendered()).toEqual(["C.webp", "A.webp", "B.webp"]);

    await settled(() => {
      gallery.form.reset({ gallery: [101, 102, 103] });
    });
    expect(rendered()).toEqual(["A.webp", "B.webp", "C.webp"]);
  });

  it("offers no reorder control when the field is not ordered", async () => {
    const gallery = field({ ordered: false });
    await gallery.pick("A.webp", "B.webp");
    await gallery.resolve("A.webp", 101);
    await gallery.resolve("B.webp", 102);

    expect(screen.queryAllByRole("button", { name: /^Reorder / })).toEqual([]);
    expect(gallery.gallery).toEqual([101, 102]);
  });
});
