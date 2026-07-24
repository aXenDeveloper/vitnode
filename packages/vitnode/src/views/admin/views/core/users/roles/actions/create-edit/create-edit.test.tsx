import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LanguagesProvider } from "@/components/languages-provider";

import { CreateEditRoleAdmin } from "./create-edit";
import { createRole, editRole } from "./mutation-api.server";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/navigation", () => ({
  usePathname: () => "/admin/core/users/roles",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("./mutation-api.server", () => ({
  createRole: vi.fn(),
  editRole: vi.fn(),
}));

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "pl", name: "Polski" },
];

const renderForm = (
  data?: React.ComponentProps<typeof CreateEditRoleAdmin>["data"],
) =>
  render(
    <LanguagesProvider languages={LANGUAGES}>
      <CreateEditRoleAdmin data={data} />
    </LanguagesProvider>,
  );

const submitForm = (el: HTMLElement) => {
  const form = el.closest("form");
  if (!form) throw new Error("Form not found");
  fireEvent.submit(form);
};

describe("CreateEditRoleAdmin", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders a per-language name select in create mode", () => {
    renderForm();

    expect(screen.getByText("form.name")).toBeDefined();
    expect(screen.getByText("form.color")).toBeDefined();
    // The multiLang language select (only shown with > 1 language).
    expect(screen.getByRole("combobox")).toBeDefined();
  });

  it("submits the name as a { languageCode, value }[] array on create", async () => {
    renderForm();

    const [nameInput] = screen.getAllByRole<HTMLInputElement>("textbox");
    fireEvent.change(nameInput, { target: { value: "Administrator" } });

    submitForm(nameInput);

    await waitFor(() => {
      expect(createRole).toHaveBeenCalledWith({
        name: [{ languageCode: "en", value: "Administrator" }],
        color: "",
      });
    });
    expect(editRole).not.toHaveBeenCalled();
  });

  it("pre-fills the translations for edit and submits via editRole", async () => {
    renderForm({
      id: 5,
      color: "#ef4444",
      name: [
        { languageCode: "en", name: "Admin" },
        { languageCode: "pl", name: "Administrator" },
      ],
    });

    // The name is a text input; the color renders on the color-picker trigger.
    const [nameInput] = screen.getAllByRole<HTMLInputElement>("textbox");
    expect(nameInput.value).toBe("Admin");
    expect(screen.getByText("#ef4444")).toBeDefined();

    submitForm(nameInput);

    await waitFor(() => {
      expect(editRole).toHaveBeenCalledWith({
        id: 5,
        name: [
          { languageCode: "en", value: "Admin" },
          { languageCode: "pl", value: "Administrator" },
        ],
        color: "#ef4444",
      });
    });
    expect(createRole).not.toHaveBeenCalled();
  });
});
