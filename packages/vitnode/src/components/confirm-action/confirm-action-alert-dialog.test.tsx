import { fireEvent, render, screen } from "@testing-library/react";
import { Trash2Icon } from "lucide-react";
import { describe, expect, it } from "vitest";

import { ConfirmActionAlertDialog } from "./confirm-action-alert-dialog";

const dialogMedia = () =>
  screen
    .getByRole("alertdialog")
    .querySelector("[data-slot=alert-dialog-media]");

describe("ConfirmActionAlertDialog", () => {
  it("shows the icon above the title in the compact layout", async () => {
    render(
      <ConfirmActionAlertDialog
        icon={<Trash2Icon />}
        onSubmit={() => {}}
        title="Delete chat?"
      >
        <button type="button">Delete</button>
      </ConfirmActionAlertDialog>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("Delete chat?")).toBeTruthy();
    expect(dialogMedia()?.querySelector("svg")?.classList).toContain(
      "lucide-trash-2",
    );
    expect(screen.getByRole("alertdialog").dataset.size).toBe("sm");
  });

  it("keeps the default layout without an icon", async () => {
    render(
      <ConfirmActionAlertDialog onSubmit={() => {}} title="Delete chat?">
        <button type="button">Delete</button>
      </ConfirmActionAlertDialog>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("Delete chat?")).toBeTruthy();
    expect(dialogMedia()).toBeNull();
    expect(screen.getByRole("alertdialog").dataset.size).toBe("default");
  });
});
