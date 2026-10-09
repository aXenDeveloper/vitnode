// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FileDropzone } from "./file-shared";

const filesTransfer = (files: File[] = []) => ({
  dataTransfer: { dropEffect: "none", files, types: ["Files"] },
});

const textTransfer = {
  dataTransfer: { dropEffect: "none", files: [], types: ["text/plain"] },
};

const renderDropzone = (
  props: Partial<React.ComponentProps<typeof FileDropzone>> = {},
) => {
  const onPick = vi.fn();
  const view = render(
    <FileDropzone
      onPick={onPick}
      pending={false}
      promptLabel="Drop a file here"
      state="idle"
      {...props}
    />,
  );
  const zone = view.container.querySelector<HTMLElement>(
    "[data-slot=file-dropzone]",
  );
  if (!zone) throw new Error("dropzone not rendered");

  return { onPick, zone };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("FileDropzone", () => {
  it("highlights the moment files are dragged in and stays lit while crossing its children", () => {
    const { zone } = renderDropzone();
    const prompt = screen.getByText("Drop a file here");

    fireEvent.dragEnter(zone, filesTransfer());
    expect(zone.hasAttribute("data-dragging")).toBe(true);

    fireEvent.dragEnter(prompt, filesTransfer());
    fireEvent.dragLeave(zone, filesTransfer());
    expect(zone.hasAttribute("data-dragging")).toBe(true);

    fireEvent.dragLeave(prompt, filesTransfer());
    expect(zone.hasAttribute("data-dragging")).toBe(false);
  });

  it("ignores a drag that carries no files", () => {
    const { zone } = renderDropzone();

    fireEvent.dragEnter(zone, textTransfer);

    expect(zone.hasAttribute("data-dragging")).toBe(false);
  });

  it("hands the dropped files over and clears the highlight", () => {
    const { onPick, zone } = renderDropzone();
    const file = new File(["bytes"], "photo.webp", { type: "image/webp" });

    fireEvent.dragEnter(zone, filesTransfer());
    fireEvent.drop(zone, filesTransfer([file]));

    expect(onPick).toHaveBeenCalledWith([file]);
    expect(zone.hasAttribute("data-dragging")).toBe(false);
  });

  it("opens the file dialog once from anywhere in the zone, including its button", () => {
    const { zone } = renderDropzone();
    const input = document.querySelector("[data-slot=file-input]");
    const click = vi.fn();
    input?.addEventListener("click", click);

    fireEvent.click(zone);
    expect(click).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole("button", { name: "core.global.file.choose" }),
    );
    expect(click).toHaveBeenCalledTimes(2);
  });

  it("does nothing while disabled", () => {
    const file = new File(["bytes"], "photo.webp", { type: "image/webp" });
    const { onPick, zone } = renderDropzone({ disabled: true });
    const input = document.querySelector("[data-slot=file-input]");
    const click = vi.fn();
    input?.addEventListener("click", click);

    fireEvent.click(zone);
    fireEvent.dragEnter(zone, filesTransfer());
    fireEvent.drop(zone, filesTransfer([file]));

    expect(click).not.toHaveBeenCalled();
    expect(onPick).not.toHaveBeenCalled();
    expect(zone.hasAttribute("data-dragging")).toBe(false);
  });

  it("shows how far the upload has got and lets it be cancelled", () => {
    const onCancel = vi.fn();
    renderDropzone({ onCancel, pending: true, progress: 0.4 });

    expect(screen.getByText("40%")).toBeDefined();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "40",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "core.global.file.cancel_upload" }),
    );
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
