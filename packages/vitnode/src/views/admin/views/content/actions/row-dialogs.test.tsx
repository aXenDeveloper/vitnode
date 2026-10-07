import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import { describe, expect, it, vi } from "vitest";

import { ContentDuplicateDialog } from "./duplicate-dialog";
import { ContentVisibilityDialog } from "./visibility-dialog";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <IntlProvider locale="en" timeZone="UTC">
    {children}
  </IntlProvider>
);

const renderVisibility = (action: "hide" | "unhide", confirmed = true) => {
  const onConfirm = vi.fn(async () => Promise.resolve(confirmed));

  render(
    <ContentVisibilityDialog
      action={action}
      onConfirm={onConfirm}
      singular="Article"
      title="Release notes"
    >
      <button type="button">open</button>
    </ContentVisibilityDialog>,
    { wrapper },
  );

  fireEvent.click(screen.getByRole("button", { name: "open" }));

  return { onConfirm };
};

describe("ContentVisibilityDialog", () => {
  it("explains what hiding does before it hides anything", async () => {
    const { onConfirm } = renderVisibility("hide");

    expect(await screen.findByText("core.content.hide.title")).toBeTruthy();
    expect(screen.getByText("core.content.hide.desc")).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "core.content.hide.confirm" }),
    );

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.queryByText("core.content.hide.title")).toBeNull();
    });
  });

  it("asks to unhide a hidden record with its own words", async () => {
    const { onConfirm } = renderVisibility("unhide");

    expect(await screen.findByText("core.content.unhide.desc")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "core.content.unhide.confirm" }),
    );

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  it("stays open when the write failed, so the editor can try again", async () => {
    const { onConfirm } = renderVisibility("hide", false);

    fireEvent.click(
      await screen.findByRole("button", { name: "core.content.hide.confirm" }),
    );

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("core.content.hide.title")).toBeTruthy();
  });

  it("does nothing when cancelled", async () => {
    const { onConfirm } = renderVisibility("hide");

    fireEvent.click(
      await screen.findByRole("button", {
        name: "core.global.confirm_action.cancel",
      }),
    );

    await waitFor(() => {
      expect(screen.queryByText("core.content.hide.title")).toBeNull();
    });
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe("ContentDuplicateDialog", () => {
  it("copies only after the confirmation", async () => {
    const onConfirm = vi.fn(async () => Promise.resolve(true));
    const onOpenChange = vi.fn();

    render(
      <ContentDuplicateDialog
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
        open
        singular="Article"
        title="Release notes"
      />,
      { wrapper },
    );

    expect(
      await screen.findByText("core.content.duplicate.title"),
    ).toBeTruthy();
    expect(screen.getByText("core.content.duplicate.desc")).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "core.content.duplicate.confirm" }),
    );

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("keeps the dialog open when the copy was refused", async () => {
    const onConfirm = vi.fn(async () => Promise.resolve(false));
    const onOpenChange = vi.fn();

    render(
      <ContentDuplicateDialog
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
        open
        singular="Article"
        title="Release notes"
      />,
      { wrapper },
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: "core.content.duplicate.confirm",
      }),
    );

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
