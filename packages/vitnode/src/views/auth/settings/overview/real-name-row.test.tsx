import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";

import type { UpdatePersonalInformationResult } from "./personal-update";

import { RealNameRow } from "./real-name-row";

vi.mock("use-intl", () => ({
  useTranslations: (namespace?: string) => (key: string) =>
    namespace ? `${namespace}.${key}` : key,
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const renderRow = ({
  canEdit = true,
  onUpdate = vi.fn().mockResolvedValue({ data: true }),
}: {
  canEdit?: boolean;
  onUpdate?: () => Promise<UpdatePersonalInformationResult>;
} = {}) => {
  render(
    <ul>
      <RealNameRow canEdit={canEdit} checked onUpdate={onUpdate} />
    </ul>,
  );

  return { onUpdate, toggle: screen.getByRole("switch") };
};

describe("RealNameRow", () => {
  it("saves the moment the switch flips", async () => {
    const { onUpdate, toggle } = renderRow();

    fireEvent.click(toggle);

    expect(onUpdate).toHaveBeenCalledWith({ showRealName: false });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });
  });

  it("holds the new position and locks the switch while saving", async () => {
    let finish: (result: UpdatePersonalInformationResult) => void = () => {};
    const { toggle } = renderRow({
      onUpdate: async () =>
        await new Promise(resolve => {
          finish = resolve;
        }),
    });

    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(toggle.hasAttribute("data-disabled")).toBe(true);

    finish({ data: true });

    await waitFor(() => {
      expect(toggle.hasAttribute("data-disabled")).toBe(false);
    });
  });

  it("goes back and says so when the save fails", async () => {
    const { toggle } = renderRow({
      onUpdate: vi.fn().mockResolvedValue({ error: { status: 500 } }),
    });

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
  });

  it("does nothing without an edit permission", () => {
    const { onUpdate, toggle } = renderRow({ canEdit: false });

    fireEvent.click(toggle);

    expect(onUpdate).not.toHaveBeenCalled();
  });
});
