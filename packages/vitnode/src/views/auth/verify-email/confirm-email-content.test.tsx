import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ConfirmEmailSubmit } from "./schema";

import { ConfirmEmailContent } from "./confirm-email-content";

const mount = async (onConfirm: ConfirmEmailSubmit) => {
  const router = createRouter({
    history: createMemoryHistory({
      initialEntries: ["/login/verify-email?token=abc"],
    }),
    routeTree: createRootRoute({
      component: () => <ConfirmEmailContent onConfirm={onConfirm} />,
    }),
  });

  render(<RouterProvider router={router} />);

  return await screen.findByRole("button", {
    name: "core.auth.verify_email.confirm.submit",
  });
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the confirmation screen", () => {
  it("waits for a click before spending the link", async () => {
    const onConfirm = vi.fn<ConfirmEmailSubmit>();

    await mount(onConfirm);

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("says the address is confirmed and points to sign-in", async () => {
    const onConfirm = vi.fn<ConfirmEmailSubmit>(async () =>
      Promise.resolve({ email: "a@b.com", kind: "confirmed" as const }),
    );

    fireEvent.click(await mount(onConfirm));

    expect(
      await screen.findByRole("heading", {
        name: "core.auth.verify_email.success.title",
      }),
    ).toBeDefined();
    expect(
      screen
        .getByRole("link", { name: "core.auth.verify_email.success.sign_in" })
        .getAttribute("href"),
    ).toBe("/login");
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("offers a new link when this one is spent or expired", async () => {
    const onConfirm = vi.fn<ConfirmEmailSubmit>(async () =>
      Promise.resolve({ kind: "invalid_token" as const }),
    );

    fireEvent.click(await mount(onConfirm));

    expect(await screen.findByRole("alert")).toBeDefined();
    expect(
      screen
        .getByRole("link", { name: "core.auth.verify_email.invalid.resend" })
        .getAttribute("href"),
    ).toBe("/login/verify-email");
  });

  it("keeps the button and shows a toast when the request fails", async () => {
    const toastError = vi.spyOn(toast, "error");
    const onConfirm = vi.fn<ConfirmEmailSubmit>(async () =>
      Promise.resolve({ kind: "error" as const }),
    );

    const button = await mount(onConfirm);
    fireEvent.click(button);

    await vi.waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("core.global.errors.title", {
        description: "core.global.errors.internal_server_error",
      });
    });
    expect(
      screen.getByRole("button", {
        name: "core.auth.verify_email.confirm.submit",
      }),
    ).toBeDefined();
  });
});
