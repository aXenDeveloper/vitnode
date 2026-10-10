// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import z from "zod";

import type { ItemAutoFormComponentProps } from "../auto-form";
import type { AutoFormFileDisplay } from "./file-display";
import type { AutoFormFileValue } from "./file-shared";

import { AutoForm } from "../auto-form";
import { AutoFormFile, AutoFormFileDisplayContext } from "./file";

const image: AutoFormFileValue = {
  id: 7,
  mimeType: "image/webp",
  name: "cover.webp",
  size: 4096,
  url: "https://cdn.test/cover.webp",
};

const pdf: AutoFormFileValue = {
  id: 7,
  mimeType: "application/pdf",
  name: "brief.pdf",
  size: 4096,
  url: "https://cdn.test/brief.pdf",
};

const renderFile = ({
  display,
  file,
}: {
  display?: AutoFormFileDisplay;
  file: AutoFormFileValue;
}) => {
  const CoverField = (props: ItemAutoFormComponentProps) => (
    <AutoFormFile
      {...props}
      file={file}
      label="Cover image"
      maxBytes={1_000_000}
      onUpload={async () => await Promise.resolve(file)}
    />
  );
  const form = (
    <AutoForm
      fields={[{ id: "cover", component: CoverField }]}
      formSchema={z.object({ cover: z.number().nullable().default(7) })}
    />
  );

  return render(
    <QueryClientProvider client={new QueryClient()}>
      {display ? (
        <AutoFormFileDisplayContext value={display}>
          {form}
        </AutoFormFileDisplayContext>
      ) : (
        form
      )}
    </QueryClientProvider>,
  );
};

describe("AutoFormFile cover display", () => {
  it("shows a stored image as a cover with replace and remove actions", () => {
    const view = renderFile({ display: "cover", file: image });

    const cover = view.container.querySelector("[data-slot=file-cover]");
    expect(cover?.querySelector("img")?.getAttribute("src")).toBe(image.url);
    expect(
      screen.getByRole("button", { name: "core.global.file.replace" }),
    ).toBeTruthy();
    expect(view.container.querySelector("[data-slot=attachment]")).toBeNull();
  });

  it("goes back to the dropzone after the cover is removed", () => {
    const view = renderFile({ display: "cover", file: image });

    fireEvent.click(
      screen.getByRole("button", { name: "core.global.file.remove" }),
    );

    expect(view.container.querySelector("[data-slot=file-cover]")).toBeNull();
    expect(
      view.container.querySelector("[data-slot=file-dropzone]"),
    ).toBeTruthy();
  });

  it("keeps the file card for a file that is not an image", () => {
    const view = renderFile({ display: "cover", file: pdf });

    expect(view.container.querySelector("[data-slot=file-cover]")).toBeNull();
    expect(view.container.querySelector("[data-slot=attachment]")).toBeTruthy();
  });

  it("keeps the file card without a cover display", () => {
    const view = renderFile({ file: image });

    expect(view.container.querySelector("[data-slot=file-cover]")).toBeNull();
    expect(view.container.querySelector("[data-slot=attachment]")).toBeTruthy();
  });
});
