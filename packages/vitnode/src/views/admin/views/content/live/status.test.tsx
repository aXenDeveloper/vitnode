// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ContentLiveAutosaveStatus,
  ContentLiveContextValue,
} from "./context";

import { ContentLiveContext } from "./context";
import { ContentLiveStatus } from "./status";

const NOW = new Date("2026-10-10T12:00:00.000Z");

const renderStatus = (status: Partial<ContentLiveAutosaveStatus>) =>
  render(
    <IntlProvider locale="en" messages={{}} timeZone="UTC">
      <ContentLiveContext
        value={
          {
            status: {
              dirty: false,
              failed: false,
              savedAt: null,
              saving: false,
              ...status,
            },
          } as ContentLiveContextValue
        }
      >
        <ContentLiveStatus />
      </ContentLiveContext>
    </IntlProvider>,
  );

describe("ContentLiveStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("says the draft was saved just now right after an autosave", () => {
    renderStatus({ savedAt: NOW.toISOString() });

    expect(
      screen.getByText("core.content.live.status.saved_just_now"),
    ).toBeTruthy();
  });

  it("switches to the relative time once a minute has passed", () => {
    renderStatus({ savedAt: NOW.toISOString() });

    act(() => {
      vi.advanceTimersByTime(75_000);
    });

    expect(
      screen.queryByText("core.content.live.status.saved_just_now"),
    ).toBeNull();
    expect(screen.getByText("core.content.live.status.saved")).toBeTruthy();
  });

  it("keeps the ticking time out of the live region", () => {
    renderStatus({ savedAt: NOW.toISOString() });

    const visible = screen.getByText("core.content.live.status.saved_just_now");

    expect(visible.getAttribute("aria-hidden")).toBe("true");
    expect(visible.getAttribute("dateTime")).toBe(NOW.toISOString());
    expect(
      screen.getByText("core.content.live.status.saved_at").className,
    ).toContain("sr-only");
  });

  it("shows saving and failure instead of the saved time", () => {
    const { rerender } = renderStatus({
      saving: true,
      savedAt: NOW.toISOString(),
    });

    expect(screen.getByText("core.content.live.status.saving")).toBeTruthy();
    expect(
      screen.queryByText("core.content.live.status.saved_just_now"),
    ).toBeNull();

    rerender(
      <IntlProvider locale="en" messages={{}} timeZone="UTC">
        <ContentLiveContext
          value={
            {
              status: {
                dirty: true,
                failed: true,
                savedAt: NOW.toISOString(),
                saving: false,
              },
            } as ContentLiveContextValue
          }
        >
          <ContentLiveStatus />
        </ContentLiveContext>
      </IntlProvider>,
    );

    expect(screen.getByText("core.content.live.status.failed")).toBeTruthy();
    expect(screen.getByText("core.content.live.status.unsaved")).toBeTruthy();
  });
});
