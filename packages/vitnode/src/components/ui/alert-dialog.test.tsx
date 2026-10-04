import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogTitle,
} from "./alert-dialog";

describe("AlertDialog buttons", () => {
  it("announce their visible text", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>Delete this thread?</AlertDialogTitle>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction>Delete thread</AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>,
    );

    expect(screen.getByRole("button", { name: "Keep it" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Delete thread" })).toBeDefined();
  });

  it("fall back to translated labels without text", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>Delete this thread?</AlertDialogTitle>
          <AlertDialogCancel />
          <AlertDialogAction />
        </AlertDialogContent>
      </AlertDialog>,
    );

    expect(
      screen.getByRole("button", { name: "core.global.cancel" }),
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: "core.global.confirm" }),
    ).toBeDefined();
  });
});
