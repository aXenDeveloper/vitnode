import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConfirmActionAlertDialog } from "./confirm-action-alert-dialog";

describe("ConfirmActionAlertDialog", () => {
  it("locks cancel while the confirmation is still submitting", async () => {
    let finishSubmit = () => {};
    render(
      <ConfirmActionAlertDialog
        onSubmit={async () =>
          await new Promise<void>(resolve => {
            finishSubmit = resolve;
          })
        }
        title="Delete chat?"
      >
        <button type="button">Delete</button>
      </ConfirmActionAlertDialog>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const cancel = await screen.findByRole("button", {
      name: "core.global.confirm_action.cancel",
    });
    expect(cancel.hasAttribute("disabled")).toBe(false);

    fireEvent.click(
      screen.getByRole("button", {
        name: "core.global.confirm_action.confirm",
      }),
    );

    await waitFor(() => {
      expect(cancel.hasAttribute("disabled")).toBe(true);
    });
    fireEvent.click(cancel);
    expect(screen.getByRole("alertdialog")).toBeTruthy();

    await act(async () => {
      finishSubmit();
    });
    await waitFor(() => {
      expect(cancel.hasAttribute("disabled")).toBe(false);
    });
  });
});
