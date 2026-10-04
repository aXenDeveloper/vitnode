import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { Toaster } from "sonner";
import { describe, expect, it, vi } from "vitest";
import z from "zod";

import type { ItemAutoFormComponentProps } from "../auto-form";
import type { AutoFormFileValue } from "./file-shared";
import type { FileUploadOptions } from "./file-upload-queue";

import { AutoForm } from "../auto-form";
import { AutoFormFiles } from "./files";

const stored = (id: number, name: string): AutoFormFileValue => ({
  id,
  mimeType: "application/pdf",
  name,
  size: 2048,
  url: `https://cdn.test/${id}.pdf`,
});

const schema = z.object({ gallery: z.array(z.number()).default([1, 2]) });

const renderFiles = (
  onUpload: (
    file: File,
    options: FileUploadOptions,
  ) => Promise<AutoFormFileValue>,
) => {
  const GalleryField = (props: ItemAutoFormComponentProps) => (
    <AutoFormFiles
      {...props}
      files={[stored(1, "first.pdf"), stored(2, "second.pdf")]}
      maxBytes={1_000_000}
      maxItems={5}
      onUpload={onUpload}
      ordered={false}
    />
  );

  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <AutoForm
        fields={[{ id: "gallery", component: GalleryField }]}
        formSchema={schema}
      />
      <Toaster />
    </QueryClientProvider>,
  );

  const pick = (name: string) => {
    const input = view.container.querySelector<HTMLInputElement>(
      "[data-slot=file-input]",
    );
    if (!input) throw new Error("file input not rendered");

    fireEvent.change(input, {
      target: {
        files: [new File(["bytes"], name, { type: "application/pdf" })],
      },
    });
  };

  const names = () =>
    [...view.container.querySelectorAll("[data-slot=attachment-title]")].map(
      title => title.getAttribute("title"),
    );

  return { names, pick };
};

const deferred = () => {
  let resolve: (value: AutoFormFileValue) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<AutoFormFileValue>((done, fail) => {
    resolve = done;
    reject = fail;
  });

  return { promise, reject, resolve };
};

describe("AutoFormFiles", () => {
  it("removes a file with an undo that puts it back where it was", async () => {
    const { names } = renderFiles(vi.fn());

    const [removeFirst] = screen.getAllByRole("button", {
      name: "core.global.file.remove_named",
    });
    fireEvent.click(removeFirst);
    expect(names()).toEqual(["second.pdf"]);

    fireEvent.click(
      await screen.findByRole("button", { name: "core.global.file.undo" }),
    );

    expect(names()).toEqual(["first.pdf", "second.pdf"]);
  });

  it("shows upload progress and cancels an upload in flight", async () => {
    const upload = deferred();
    let options: FileUploadOptions | undefined;
    const { names, pick } = renderFiles(async (_file, given) => {
      options = given;

      return await upload.promise;
    });

    await act(async () => {
      pick("third.pdf");
      await Promise.resolve();
    });
    act(() => {
      options?.onProgress(0.25);
    });

    expect(screen.getByText("25%")).toBeDefined();

    fireEvent.click(
      screen.getByRole("button", {
        name: "core.global.file.cancel_upload_named",
      }),
    );

    expect(options?.signal.aborted).toBe(true);
    expect(screen.queryByText("25%")).toBeNull();

    await act(async () => {
      upload.resolve(stored(3, "third.pdf"));
      await Promise.resolve();
    });

    expect(names()).toEqual(["first.pdf", "second.pdf"]);
  });

  it("keeps a failed upload as a card that can be retried", async () => {
    const attempts = [deferred(), deferred()];
    let call = 0;
    const { names, pick } = renderFiles(async () => {
      const attempt = attempts[call];
      call += 1;

      return await attempt.promise;
    });

    await act(async () => {
      pick("third.pdf");
      await Promise.resolve();
    });
    await act(async () => {
      attempts[0].reject(new Error("The network went away"));
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const alert = await screen.findByText("The network went away");
    expect(alert.getAttribute("role")).toBe("alert");

    const failedCard = alert.closest<HTMLElement>("[data-slot=attachment]");
    if (!failedCard) throw new Error("failed card not rendered");

    await act(async () => {
      fireEvent.click(
        within(failedCard).getByRole("button", {
          name: "core.global.file.retry_named",
        }),
      );
      await Promise.resolve();
    });
    await act(async () => {
      attempts[1].resolve(stored(3, "third.pdf"));
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(screen.queryByText("The network went away")).toBeNull();
    expect(names()).toEqual(["first.pdf", "second.pdf", "third.pdf"]);
  });
});
