import { fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import { describe, expect, it, vi } from "vitest";

import type { AiHistoryItem, AiUsage } from "./ai-usage-query";

import { AiHistoryContent } from "./ai-history-content";
import { AiUsageContent } from "./ai-usage-content";

const NOTICE = "core.auth.settings.ai.notice";

const usage = (overrides: Partial<AiUsage> = {}): AiUsage => ({
  actions: [
    {
      dailyLimit: 5,
      description: "Write an excerpt",
      key: "@vitnode/blog:excerpt.generate",
      permissionKey: "@vitnode/blog:excerpt",
      usedToday: 2,
    },
  ],
  enabled: true,
  notice: "none",
  points: { available: "60", reserved: "0", total: "100", used: "40" },
  resetsAt: "2026-11-01T00:00:00.000Z",
  sitePaused: false,
  ...overrides,
});

const renderInIntl = (ui: React.ReactNode) =>
  render(
    <IntlProvider locale="en" messages={{}} timeZone="UTC">
      {ui}
    </IntlProvider>,
  );

describe("AiUsageContent", () => {
  it("warns once most of the allowance is gone", () => {
    renderInIntl(<AiUsageContent usage={usage({ notice: "near_limit" })} />);

    expect(screen.getByText(`${NOTICE}.near_limit.title`)).toBeTruthy();
    expect(screen.queryByText(`${NOTICE}.exhausted.title`)).toBeNull();
    expect(screen.queryByText(`${NOTICE}.site_paused.title`)).toBeNull();
  });

  it("says the allowance is spent when it is", () => {
    renderInIntl(
      <AiUsageContent
        usage={usage({
          notice: "exhausted",
          points: { available: "0", reserved: "0", total: "100", used: "100" },
        })}
      />,
    );

    expect(screen.getByRole("alert").textContent).toContain(
      `${NOTICE}.exhausted.title`,
    );
    expect(screen.queryByText(`${NOTICE}.near_limit.title`)).toBeNull();
  });

  it("blames the site budget, not the member, when the site is paused", () => {
    renderInIntl(
      <AiUsageContent
        usage={usage({ notice: "site_paused", sitePaused: true })}
      />,
    );

    expect(screen.getByText(`${NOTICE}.site_paused.title`)).toBeTruthy();
    expect(screen.queryByText(`${NOTICE}.exhausted.title`)).toBeNull();
    expect(screen.queryByText(`${NOTICE}.near_limit.title`)).toBeNull();
  });

  it("tells a member with no allowance to ask, not that they used it up", () => {
    renderInIntl(
      <AiUsageContent
        usage={usage({
          notice: "no_allowance",
          points: { available: "0", reserved: "0", total: "0", used: "0" },
        })}
      />,
    );

    expect(screen.getByText(`${NOTICE}.no_allowance.title`)).toBeTruthy();
    expect(screen.queryByText(`${NOTICE}.exhausted.title`)).toBeNull();
    expect(screen.queryByText(`${NOTICE}.exhausted.desc`)).toBeNull();
  });

  it("shows no notice while there is room left", () => {
    renderInIntl(<AiUsageContent usage={usage()} />);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(`${NOTICE}.site_paused.title`)).toBeNull();
  });

  it("reports the points used as an accessible progress bar", () => {
    renderInIntl(<AiUsageContent usage={usage()} />);

    const bar = screen.getByRole("progressbar", {
      name: "core.auth.settings.ai.points.used",
    });

    expect(bar.getAttribute("aria-valuenow")).toBe("40");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
  });

  it("draws no bar for an unlimited allowance", () => {
    renderInIntl(
      <AiUsageContent
        usage={usage({
          points: { available: null, reserved: "1.5", total: null, used: "7" },
        })}
      />,
    );

    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(
      screen.getByText("core.auth.settings.ai.points.unlimited"),
    ).toBeTruthy();
  });

  it("lists each feature's daily limit with its key", () => {
    renderInIntl(<AiUsageContent usage={usage()} />);

    expect(screen.getByText("Write an excerpt")).toBeTruthy();
    expect(screen.getByText("@vitnode/blog:excerpt.generate")).toBeTruthy();
  });
});

describe("AiHistoryContent", () => {
  const item: AiHistoryItem = {
    accepted: null,
    actionKey: "@vitnode/blog:excerpt.generate",
    chargedPoints: "0.04",
    createdAt: "2026-10-01T10:00:00.000Z",
    errorCode: null,
    id: 7,
    status: "succeeded",
  };

  it("names an operation by what it does and loads more on request", () => {
    const onLoadMore = vi.fn();

    renderInIntl(
      <AiHistoryContent
        actions={usage().actions}
        hasNextPage
        isFetchingNextPage={false}
        items={[item]}
        onLoadMore={onLoadMore}
      />,
    );

    expect(screen.getByText("Write an excerpt")).toBeTruthy();
    expect(
      screen.getByText("core.auth.settings.ai.status.succeeded"),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: "core.auth.settings.ai.history.load_more",
      }),
    );

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("offers nothing more once the last page is shown", () => {
    renderInIntl(
      <AiHistoryContent
        actions={[]}
        hasNextPage={false}
        isFetchingNextPage={false}
        items={[]}
        onLoadMore={vi.fn()}
      />,
    );

    expect(
      screen.getByText("core.auth.settings.ai.history.empty"),
    ).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
