import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

/**
 * Counts how many times a dialog's body was actually mounted.
 *
 * This is the property every lazy `React.Suspense` dialog in the AdminCP relies
 * on: a table of 50 rows renders 50 triggers, and the body of a dialog - the
 * lazily loaded form and all of its `react-hook-form` state - must only exist
 * while that one dialog is open.
 */
const Body = ({ onMount }: { onMount: () => void }) => {
  React.useEffect(onMount, [onMount]);

  return <p>dialog body</p>;
};

const Harness = ({ onMount }: { onMount: () => void }) => (
  <Dialog>
    <DialogTrigger>open</DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Title</DialogTitle>
      </DialogHeader>
      <Body onMount={onMount} />
    </DialogContent>
  </Dialog>
);

describe("Dialog", () => {
  it("does not mount its body until it is opened", () => {
    const onMount = vi.fn();

    render(<Harness onMount={onMount} />);

    expect(screen.queryByText("dialog body")).toBeNull();
    expect(onMount).not.toHaveBeenCalled();
  });

  it("mounts the body on open and unmounts it again on close", async () => {
    const onMount = vi.fn();

    render(<Harness onMount={onMount} />);

    fireEvent.click(screen.getByText("open"));
    await waitFor(() => {
      expect(screen.queryByText("dialog body")).not.toBeNull();
    });
    expect(onMount).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByText("dialog body")).toBeNull();
    });
  });

  it("keeps every other dialog's body out of the tree", async () => {
    const first = vi.fn();
    const second = vi.fn();

    render(
      <>
        <Harness onMount={first} />
        <Harness onMount={second} />
      </>,
    );

    fireEvent.click(screen.getAllByText("open")[0]);
    await waitFor(() => {
      expect(screen.queryByText("dialog body")).not.toBeNull();
    });

    // One body in the document, and the sibling dialog never built its own.
    expect(screen.getAllByText("dialog body")).toHaveLength(1);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });
});
