import { render, screen, within } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import { describe, expect, it } from "vitest";

import type { AdminComponentUpdate } from "./plugin-updates-query";

import { PluginUpdateStatus, SecurityAdvisories } from "./plugin-update-status";

const T = "admin.system.plugins.updates";

const ADVISORY = {
  affected: "<1.1.0",
  fixed: "1.1.0",
  id: "ACME-1",
  severity: "critical" as const,
  summary: "Stored XSS in post titles",
  url: "https://acme.example.com/advisories/1",
  versions: ["1.0.0"],
};

const update = (
  overrides: Partial<AdminComponentUpdate> = {},
  result: Partial<NonNullable<AdminComponentUpdate["result"]>> = {},
): AdminComponentUpdate => ({
  id: "@acme/blog",
  lastAttemptAt: "2026-10-15T03:00:00.000Z",
  lastError: null,
  lastSuccessAt: "2026-10-15T03:00:00.000Z",
  result: {
    advisories: [],
    alternative: null,
    channel: "stable",
    compatibility: "compatible",
    latest: {
      publishedAt: null,
      requiresCore: "^2.0.0",
      url: "https://acme.example.com/releases/1.1.0",
      version: "1.1.0",
    },
    status: "update_available",
    ...result,
  },
  sourceUrl: "https://acme.example.com/updates.json",
  stale: false,
  state: "checked",
  ...overrides,
});

const renderWithIntl = (node: React.ReactNode) =>
  render(
    <IntlProvider locale="en" messages={{}} timeZone="UTC">
      {node}
    </IntlProvider>,
  );

const renderStatus = (value: AdminComponentUpdate, enabled = true) =>
  renderWithIntl(
    <PluginUpdateStatus coreVersion="2.0.0" enabled={enabled} update={value} />,
  );

describe("SecurityAdvisories", () => {
  it("lists each advisory with its title, summary and an https link", () => {
    renderWithIntl(
      <SecurityAdvisories update={update({}, { advisories: [ADVISORY] })} />,
    );

    const list = screen.getByRole("list", { name: `${T}.security.label` });
    const item = within(list).getByRole("listitem");
    expect(within(item).getByText(`${T}.security.title`)).toBeTruthy();
    expect(within(item).getByText("Stored XSS in post titles")).toBeTruthy();
    expect(
      within(item)
        .getByRole("link", { name: `${T}.security.details` })
        .getAttribute("href"),
    ).toBe("https://acme.example.com/advisories/1");
  });

  it.each([
    "http://acme.example.com/advisories/1",
    "javascript:alert(1)",
    "not a url",
  ])("does not link to %s", url => {
    renderWithIntl(
      <SecurityAdvisories
        update={update({}, { advisories: [{ ...ADVISORY, url }] })}
      />,
    );

    expect(screen.getByText(`${T}.security.title`)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("says when no fix is available yet", () => {
    renderWithIntl(
      <SecurityAdvisories
        update={update({}, { advisories: [{ ...ADVISORY, fixed: null }] })}
      />,
    );

    expect(screen.getByText(new RegExp(`${T}.security.no_fix`))).toBeTruthy();
  });

  it("renders nothing without advisories", () => {
    const { container } = renderWithIntl(
      <SecurityAdvisories update={update()} />,
    );

    expect(container.childElementCount).toBe(0);
  });
});

describe("PluginUpdateStatus", () => {
  it("shows the available update with its release notes", () => {
    renderStatus(update());

    expect(screen.getByText(`${T}.status.update_available`)).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: `${T}.release_notes` })
        .getAttribute("href"),
    ).toBe("https://acme.example.com/releases/1.1.0");
  });

  it("warns about an incompatible update and offers the compatible one", () => {
    renderStatus(
      update(
        {},
        {
          alternative: {
            publishedAt: null,
            requiresCore: "^2.0.0",
            url: null,
            version: "1.0.5",
          },
          compatibility: "incompatible",
        },
      ),
    );

    expect(screen.getByText(`${T}.compatibility.incompatible`)).toBeTruthy();
    expect(screen.getByText(`${T}.compatibility.alternative`)).toBeTruthy();
  });

  it("keeps the previous result next to a failed check", () => {
    renderStatus(update({ lastError: { code: "timeout", detail: null } }));

    expect(screen.getByText(`${T}.status.update_available`)).toBeTruthy();
    expect(screen.getByText(`${T}.failed_with_previous`)).toBeTruthy();
    expect(screen.queryByText(`${T}.checked_at`)).toBeNull();
  });

  it("reports a check that failed before anything was found", () => {
    renderStatus(
      update({
        lastError: { code: "blocked_address", detail: null },
        lastSuccessAt: null,
        result: null,
        state: "not_checked",
      }),
    );

    expect(screen.getByText(`${T}.failed`)).toBeTruthy();
    expect(screen.queryByText(`${T}.status.not_checked`)).toBeNull();
  });

  it("marks a result not yet confirmed for what runs now as stale", () => {
    renderStatus(update({ stale: true }));

    expect(screen.getByText(`${T}.stale`)).toBeTruthy();
    expect(screen.queryByText(`${T}.checked_at`)).toBeNull();
  });

  it("says when the last check is current", () => {
    renderStatus(update());

    expect(screen.getByText(`${T}.checked_at`)).toBeTruthy();
  });

  it.each([
    ["checks are turned off", update(), false, `${T}.status.disabled`],
    [
      "the plugin declares no update source",
      update({ result: null, sourceUrl: null, state: "unavailable" }),
      true,
      `${T}.status.unavailable`,
    ],
    [
      "nothing was checked yet",
      update({ lastSuccessAt: null, result: null, state: "not_checked" }),
      true,
      `${T}.status.not_checked`,
    ],
  ])("says so when %s", (_, value, enabled, text) => {
    renderStatus(value, enabled);

    expect(screen.getByText(text)).toBeTruthy();
  });
});
