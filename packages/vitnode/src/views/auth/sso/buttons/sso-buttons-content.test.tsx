// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import { describe, expect, it, vi } from "vitest";

import type { SSOSelectProvider, SSOStartResult } from "./sso-buttons-content";

import { SSOButtonsContent } from "./sso-buttons-content";

const PROVIDERS = [
  { brandColor: "#5865f2", id: "discord", name: "Discord" },
  { id: "google", name: "Google" },
];

const renderButtons = (onSelectProvider: SSOSelectProvider) =>
  render(
    <IntlProvider locale="en" messages={{}} timeZone="UTC">
      <SSOButtonsContent
        onSelectProvider={onSelectProvider}
        providers={PROVIDERS}
      />
    </IntlProvider>,
  );

const deferred = () => {
  let resolve: (value: SSOStartResult) => void = () => undefined;
  const promise = new Promise<SSOStartResult>(done => {
    resolve = done;
  });

  return { promise, resolve };
};

describe("SSOButtonsContent", () => {
  it("renders one button per provider", () => {
    renderButtons(vi.fn());

    expect(
      screen.getAllByRole("button", { name: "core.auth.sso.continue_with" }),
    ).toHaveLength(2);
  });

  it("starts the chosen provider and locks the row while it redirects", async () => {
    const start = deferred();
    const onSelectProvider = vi.fn(async () => start.promise);
    renderButtons(onSelectProvider);

    const [discord, google] = screen.getAllByRole("button");
    await act(async () => {
      fireEvent.click(discord);
    });

    expect(onSelectProvider).toHaveBeenCalledWith("discord");
    expect(
      screen.getByRole("button", { name: "core.global.loading" }),
    ).toBeTruthy();
    expect((google as HTMLButtonElement).disabled).toBe(true);
  });

  it("unlocks the row when the provider could not be started", async () => {
    const onSelectProvider = vi.fn(async () => ({ message: "failed" }));
    renderButtons(onSelectProvider);

    await act(async () => {
      fireEvent.click(screen.getAllByRole("button")[1]);
    });

    const buttons = screen.getAllByRole("button", {
      name: "core.auth.sso.continue_with",
    });
    expect(buttons).toHaveLength(2);
    expect(
      buttons.every(button => !(button as HTMLButtonElement).disabled),
    ).toBe(true);
  });
});
