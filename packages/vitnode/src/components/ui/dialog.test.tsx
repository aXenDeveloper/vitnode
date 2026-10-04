import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
  useDialog,
} from "./dialog";

const DirtyForm = () => {
  const { setIsDirty } = useDialog();

  React.useEffect(() => {
    setIsDirty?.(true);
  }, [setIsDirty]);

  return <p>Unsaved form</p>;
};

const renderDirtyDialog = async () => {
  render(
    <Dialog>
      <DialogTrigger>Open</DialogTrigger>
      <DialogContent>
        <DialogTitle>Edit</DialogTitle>
        <DirtyForm />
      </DialogContent>
    </Dialog>,
  );
  const trigger = screen.getByRole("button", { name: "Open" });
  trigger.focus();
  fireEvent.click(trigger);
  await screen.findByText("Unsaved form");
  fireEvent.click(screen.getByRole("button", { name: "core.global.close" }));

  return await screen.findByRole("alertdialog");
};

describe("Dialog with unsaved changes", () => {
  it("asks before closing and keeps the form open on cancel", async () => {
    await renderDirtyDialog();

    fireEvent.click(
      screen.getByRole("button", {
        name: "core.global.are_you_sure_want_to_leave_form.cancel",
      }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
    expect(screen.getByText("Unsaved form")).toBeTruthy();
  });

  it("closes the dialog right away once leaving is confirmed", async () => {
    await renderDirtyDialog();

    fireEvent.click(
      screen.getByRole("button", {
        name: "core.global.are_you_sure_want_to_leave_form.confirm",
      }),
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Unsaved form")).toBeNull();
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Open" }),
      );
    });
  });
});
