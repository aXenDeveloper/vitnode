import { render as renderDom, screen } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import { describe, expect, it } from "vitest";

import type { CronHealth } from "./cron-query";

import { CronSchedulerStatus } from "./cron-scheduler-status";

const NAMESPACE = "admin.advanced.cron.health";

const render = (ui: React.ReactElement) =>
  renderDom(
    <IntlProvider
      locale="en"
      messages={{}}
      now={new Date("2026-10-04T15:35:00Z")}
      timeZone="UTC"
    >
      {ui}
    </IntlProvider>,
  );

const health = (overrides: Partial<CronHealth>): CronHealth => ({
  active: true,
  jobs: 5,
  lastRun: "2026-10-04T15:34:00Z",
  nextRun: "2026-10-04T15:40:00Z",
  overdueJobs: 0,
  secretRejected: false,
  stale: false,
  ...overrides,
});

describe("CronSchedulerStatus", () => {
  it("reports every job on schedule", () => {
    render(<CronSchedulerStatus health={health({})} />);

    expect(
      screen.getByRole("heading", { name: `${NAMESPACE}.ok.title` }),
    ).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.queryByText(`${NAMESPACE}.stale.help`)).toBeNull();
  });

  it("calls out overdue jobs while the scheduler still ticks", () => {
    render(<CronSchedulerStatus health={health({ overdueJobs: 2 })} />);

    expect(
      screen.getByRole("heading", { name: `${NAMESPACE}.overdue.title` }),
    ).toBeTruthy();
    expect(screen.getByText(`${NAMESPACE}.overdue.desc`)).toBeTruthy();
  });

  it("reports a stopped scheduler with help and no next run", () => {
    render(
      <CronSchedulerStatus
        health={health({
          lastRun: "2026-09-06T16:41:00Z",
          overdueJobs: 5,
          stale: true,
        })}
      />,
    );

    expect(
      screen.getByRole("heading", { name: `${NAMESPACE}.stale.title` }),
    ).toBeTruthy();
    expect(screen.getByText(`${NAMESPACE}.stale.desc`)).toBeTruthy();
    expect(screen.getByText(`${NAMESPACE}.stale.help`)).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
    expect(
      screen.queryByText(`${NAMESPACE}.no_adapter`, { exact: false }),
    ).toBeNull();
  });

  it("explains a missing adapter when no job has ever run", () => {
    render(
      <CronSchedulerStatus
        health={health({
          active: false,
          lastRun: null,
          nextRun: null,
          overdueJobs: 1,
          stale: true,
        })}
      />,
    );

    expect(screen.getByText(`${NAMESPACE}.stale.desc_never`)).toBeTruthy();
    expect(
      screen.getByText(`${NAMESPACE}.no_adapter`, { exact: false }),
    ).toBeTruthy();
    expect(screen.getByText(`${NAMESPACE}.facts.never`)).toBeTruthy();
  });

  it("names a rejected CRON_SECRET as the reason nothing runs", () => {
    render(
      <CronSchedulerStatus
        health={health({ overdueJobs: 5, secretRejected: true, stale: true })}
      />,
    );

    expect(
      screen.getByText(`${NAMESPACE}.secret_rejected`, { exact: false }),
    ).toBeTruthy();
    expect(
      screen.queryByText(`${NAMESPACE}.no_adapter`, { exact: false }),
    ).toBeNull();
  });
});
