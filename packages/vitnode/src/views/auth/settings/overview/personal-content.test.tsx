import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PersonalInformationFields } from "@/lib/user-personal-information";

import type { PersonalInformationUser } from "./personal-content";

import { PersonalInformationContent } from "./personal-content";

vi.mock("use-intl", () => ({
  useTranslations: (namespace?: string) => (key: string) =>
    namespace ? `${namespace}.${key}` : key,
}));

vi.mock("./personal-field-editor", () => ({
  PersonalFieldEditor: ({
    field,
    onClose,
  }: {
    field: string;
    onClose: () => void;
  }) => (
    <button onClick={onClose} type="button">
      close {field}
    </button>
  ),
}));

const label = (key: string) => `core.auth.settings.overview.${key}`;

const user: PersonalInformationUser = {
  email: "ada@example.com",
  emailVerified: true,
  firstName: "Ada",
  headline: "Writes the first program",
  lastName: "Lovelace",
  name: "ada",
  phone: null,
  secondaryRoles: [],
  showRealName: true,
};

const fields: PersonalInformationFields = {
  firstName: true,
  headline: false,
  lastName: true,
  phone: true,
  showRealName: true,
};

const renderContent = (canEdit = true) =>
  render(
    <PersonalInformationContent
      canEdit={canEdit}
      fields={fields}
      onUpdate={vi.fn()}
      user={user}
    />,
  );

describe("PersonalInformationContent", () => {
  it("lists one row per enabled field and marks the empty ones", () => {
    renderContent();

    expect(screen.getByText(label("firstName"))).toBeDefined();
    expect(screen.getByText("Lovelace")).toBeDefined();
    expect(screen.getByText(label("notSet"))).toBeDefined();
    expect(screen.queryByText(label("headline"))).toBeNull();
    expect(screen.getByText(label("personalDesc"))).toBeDefined();
  });

  it("opens a row in place and gives focus back to it when the editor closes", async () => {
    renderContent();

    fireEvent.click(screen.getByRole("button", { name: /firstName/ }));

    const close = await screen.findByRole("button", {
      name: "close firstName",
    });
    expect(screen.queryByRole("button", { name: /firstName.*Ada/ })).toBeNull();

    fireEvent.click(close);

    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: /firstName/ }),
      );
    });
  });

  it("keeps only one row open at a time", async () => {
    renderContent();

    fireEvent.click(screen.getByRole("button", { name: /firstName/ }));
    await screen.findByRole("button", { name: "close firstName" });

    fireEvent.click(screen.getByRole("button", { name: /lastName/ }));

    await screen.findByRole("button", { name: "close lastName" });
    expect(
      screen.queryByRole("button", { name: "close firstName" }),
    ).toBeNull();
  });

  it("shows plain rows without an edit permission", () => {
    renderContent(false);

    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByText("Ada")).toBeDefined();
    expect(screen.queryByText(label("personalDesc"))).toBeNull();
  });
});
