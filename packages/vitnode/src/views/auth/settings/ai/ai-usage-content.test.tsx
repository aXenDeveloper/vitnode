import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { IntlProvider } from "use-intl";
import { describe, expect, it } from "vitest";

import type { AiUsage } from "./ai-usage-query";

import { AiUsageContent } from "./ai-usage-content";
import { aiHistoryQueryOptions } from "./ai-usage-query";

const NOTICE = "core.auth.settings.ai.notice";
const FEATURES = "core.auth.settings.ai.features";

const usage = (overrides: Partial<AiUsage> = {}): AiUsage => ({
  actions: [
    {
      dailyLimit: 5,
      description: "Writes a short excerpt for an article.",
      icon: "text-quote",
      key: "@vitnode/blog:excerpt.generate",
      monthPoints: "12.5",
      permissionKey: "@vitnode/blog:excerpt",
      title: "Generate excerpt",
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

const newQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

const runsKey = () =>
  aiHistoryQueryOptions({
    action: "@vitnode/blog:excerpt.generate",
    limit: 5,
    userId: 7,
  }).queryKey;

const renderUsage = (value: AiUsage, queryClient = newQueryClient()) =>
  render(
    <IntlProvider locale="en" messages={{}} timeZone="UTC">
      <QueryClientProvider client={queryClient}>
        <AiUsageContent usage={value} userId={7} />
      </QueryClientProvider>
    </IntlProvider>,
  );

describe("AiUsageContent", () => {
  it("warns once most of the allowance is gone", () => {
    renderUsage(usage({ notice: "near_limit" }));

    expect(screen.getByText(`${NOTICE}.near_limit.title`)).toBeTruthy();
    expect(screen.queryByText(`${NOTICE}.exhausted.title`)).toBeNull();
    expect(screen.queryByText(`${NOTICE}.site_paused.title`)).toBeNull();
  });

  it("says the allowance is spent when it is", () => {
    renderUsage(
      usage({
        notice: "exhausted",
        points: { available: "0", reserved: "0", total: "100", used: "100" },
      }),
    );

    expect(screen.getByRole("alert").textContent).toContain(
      `${NOTICE}.exhausted.title`,
    );
    expect(screen.queryByText(`${NOTICE}.near_limit.title`)).toBeNull();
  });

  it("blames the site budget, not the member, when the site is paused", () => {
    renderUsage(usage({ notice: "site_paused", sitePaused: true }));

    expect(screen.getByText(`${NOTICE}.site_paused.title`)).toBeTruthy();
    expect(screen.queryByText(`${NOTICE}.exhausted.title`)).toBeNull();
  });

  it("tells a member with no allowance to ask, without a bar", () => {
    renderUsage(
      usage({
        actions: [],
        notice: "no_allowance",
        points: { available: "0", reserved: "0", total: "0", used: "0" },
      }),
    );

    expect(screen.getByText(`${NOTICE}.no_allowance.title`)).toBeTruthy();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByText(`${FEATURES}.empty_title`)).toBeTruthy();
  });

  it("shows the share of points used next to an accessible bar", () => {
    renderUsage(
      usage({
        points: { available: "8", reserved: "2", total: "100", used: "90" },
      }),
    );

    const bar = screen.getByRole("progressbar", {
      name: "core.auth.settings.ai.points.left",
    });

    expect(bar.getAttribute("aria-valuenow")).toBe("92");
    expect(
      screen.getByText("core.auth.settings.ai.points.percent_used"),
    ).toBeTruthy();
  });

  it("draws no bar for an unlimited allowance", () => {
    renderUsage(
      usage({
        points: { available: null, reserved: "1.5", total: null, used: "7" },
      }),
    );

    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(
      screen.getByText("core.auth.settings.ai.points.unlimited"),
    ).toBeTruthy();
  });

  it("breaks an unlimited allowance down by the features that used it", () => {
    const base = usage().actions[0];
    renderUsage(
      usage({
        actions: [
          { ...base, key: "translate", monthPoints: "4", title: "Translate" },
          base,
          { ...base, key: "tags", monthPoints: "0", title: "Suggest tags" },
        ],
        points: { available: null, reserved: "0", total: null, used: "16.5" },
      }),
    );

    const breakdown = screen.getByRole("list", {
      name: "core.auth.settings.ai.points.breakdown.label",
    });
    const rows = within(breakdown).getAllByRole("listitem");

    expect(rows.map(row => row.textContent)).toEqual([
      expect.stringContaining("Generate excerpt"),
      expect.stringContaining("Translate"),
    ]);
    expect(rows[0].textContent).toContain("76%");
    expect(within(breakdown).queryByText("Suggest tags")).toBeNull();
  });

  it("says nothing was used yet instead of drawing an empty breakdown", () => {
    renderUsage(
      usage({
        actions: [{ ...usage().actions[0], monthPoints: "0" }],
        points: { available: null, reserved: "0", total: null, used: "0" },
      }),
    );

    expect(
      screen.getByText("core.auth.settings.ai.points.breakdown.empty"),
    ).toBeTruthy();
    expect(
      screen.queryByRole("list", {
        name: "core.auth.settings.ai.points.breakdown.label",
      }),
    ).toBeNull();
  });

  it("lists each feature by its title with today's use", () => {
    renderUsage(usage());

    expect(screen.getByText("Generate excerpt")).toBeTruthy();
    expect(screen.getAllByText(`${FEATURES}.today`).length).toBeGreaterThan(0);
  });

  it("says when a feature hit its daily limit", () => {
    renderUsage(
      usage({
        actions: [{ ...usage().actions[0], usedToday: 5 }],
      }),
    );

    expect(
      screen.getAllByText(`${FEATURES}.limit_reached`).length,
    ).toBeGreaterThan(0);
  });

  it("shows an opened feature's runs, badging only the ones that did not succeed", async () => {
    const queryClient = newQueryClient();
    queryClient.setQueryData(runsKey(), {
      pageParams: [undefined],
      pages: [
        {
          items: [
            {
              accepted: null,
              actionKey: "@vitnode/blog:excerpt.generate",
              chargedPoints: "4.2",
              createdAt: "2026-10-08T10:00:00.000Z",
              errorCode: null,
              id: 31,
              status: "succeeded",
            },
            {
              accepted: null,
              actionKey: "@vitnode/blog:excerpt.generate",
              chargedPoints: null,
              createdAt: "2026-10-08T09:00:00.000Z",
              errorCode: "AI_PROVIDER_ERROR",
              id: 30,
              status: "failed",
            },
          ],
          nextBefore: null,
        },
      ],
    });
    renderUsage(usage(), queryClient);

    expect(screen.queryByText(`${FEATURES}.charge`)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Generate excerpt/ }));

    expect(await screen.findByText(`${FEATURES}.charge`)).toBeTruthy();
    expect(
      screen.getByText("core.auth.settings.ai.status.failed"),
    ).toBeTruthy();
    expect(
      screen.queryByText("core.auth.settings.ai.status.succeeded"),
    ).toBeNull();
  });

  it("tells the member when an opened feature has no runs", async () => {
    const queryClient = newQueryClient();
    queryClient.setQueryData(runsKey(), {
      pageParams: [undefined],
      pages: [{ items: [], nextBefore: null }],
    });
    renderUsage(usage(), queryClient);

    fireEvent.click(screen.getByRole("button", { name: /Generate excerpt/ }));

    await waitFor(() => {
      expect(screen.getByText(`${FEATURES}.runs_empty`)).toBeTruthy();
    });
  });

  it("offers a retry instead of claiming no runs when loading fails", async () => {
    renderUsage(usage());

    fireEvent.click(screen.getByRole("button", { name: /Generate excerpt/ }));

    expect(await screen.findByText(`${FEATURES}.runs_error`)).toBeTruthy();
    expect(screen.queryByText(`${FEATURES}.runs_empty`)).toBeNull();
  });
});
