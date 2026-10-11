import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { IntlProvider } from "use-intl";
import { describe, expect, it, vi } from "vitest";

import type { FileAlt } from "./file-alt-query";

import { FileAltEditor } from "./file-alt-editor";

const ALT = "admin.system.files.alt";

const data: FileAlt = {
  altPolicy: "automatic",
  languages: [
    {
      code: "en",
      name: "English",
      origin: "ai",
      stale: true,
      text: "A red bicycle against a wall",
      updatedAt: "2026-10-01T10:00:00.000Z",
    },
    {
      code: "pl",
      name: "Polski",
      origin: "human",
      stale: false,
      text: "",
      updatedAt: "2026-10-02T10:00:00.000Z",
    },
    {
      code: "de",
      name: "Deutsch",
      origin: null,
      stale: false,
      text: null,
      updatedAt: null,
    },
  ],
};

const renderEditor = async (canEdit = true) => {
  const props = {
    canEdit,
    data,
    onPolicyChange: vi.fn(async () => Promise.resolve({ data: true as const })),
    onRemove: vi.fn(async () => Promise.resolve({ data: true as const })),
    onSave: vi.fn(async () => Promise.resolve({ data: true as const })),
  };

  render(
    <IntlProvider locale="en" messages={{}} timeZone="UTC">
      <FileAltEditor {...props} />
    </IntlProvider>,
  );
  await screen.findByText("English");

  return props;
};

const itemOf = (name: string) => {
  const item = screen.getByText(name).closest("li");
  if (!item) throw new Error(`No list item for ${name}`);

  return within(item);
};

describe("FileAltEditor", () => {
  it("marks where each language's text came from", async () => {
    await renderEditor();

    expect(itemOf("English").getByText(`${ALT}.origin.ai`)).toBeTruthy();
    expect(itemOf("English").getByText(`${ALT}.origin.stale`)).toBeTruthy();
    expect(itemOf("Polski").getByText(`${ALT}.origin.human`)).toBeTruthy();
    expect(itemOf("Deutsch").getByText(`${ALT}.origin.missing`)).toBeTruthy();
  });

  it("explains an empty text as a deliberate 'no description'", async () => {
    await renderEditor();

    expect(
      itemOf("Polski").getByText(`${ALT}.intentionally_empty`),
    ).toBeTruthy();
    expect(
      itemOf("Deutsch").queryByText(`${ALT}.intentionally_empty`),
    ).toBeNull();
    expect(screen.getByText(`${ALT}.empty_hint`)).toBeTruthy();
  });

  it("offers removal only where there is a text to remove", async () => {
    await renderEditor();

    expect(
      itemOf("English").getByRole("button", { name: `${ALT}.remove.button` }),
    ).toBeTruthy();
    expect(
      itemOf("Deutsch").queryByRole("button", { name: `${ALT}.remove.button` }),
    ).toBeNull();
  });

  it("removes a language's text so automatic ALT can write it again", async () => {
    const props = await renderEditor();

    fireEvent.click(
      itemOf("English").getByRole("button", { name: `${ALT}.remove.button` }),
    );

    await waitFor(() => {
      expect(props.onRemove).toHaveBeenCalledWith("en");
    });
  });

  it("shows the text read-only without can_edit_alt", async () => {
    await renderEditor(false);

    expect(screen.getByText("A red bicycle against a wall")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(
      screen.getByLabelText<HTMLSelectElement>(`${ALT}.policy.label`).disabled,
    ).toBe(true);
  });
});
