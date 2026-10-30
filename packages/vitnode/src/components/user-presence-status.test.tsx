import { render, screen } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import { describe, expect, it } from "vitest";

import type { UserPresence } from "@/lib/user-presence";

import {
  type PresenceVariant,
  UserPresenceStatus,
} from "./user-presence-status";

const T = "core.global.presence";
const SEEN = "2026-10-17T11:30:00.000Z";

const ONLINE: UserPresence = { lastSeenAt: SEEN, status: "online" };
const OFFLINE: UserPresence = { lastSeenAt: SEEN, status: "offline" };
const NEVER_SEEN: UserPresence = { lastSeenAt: null, status: "offline" };
const HIDDEN: UserPresence = { status: "hidden" };

const renderStatus = (presence: UserPresence, variant: PresenceVariant) =>
  render(
    <IntlProvider locale="en" messages={{}} timeZone="UTC">
      <UserPresenceStatus presence={presence} variant={variant} />
    </IntlProvider>,
  );

describe("UserPresenceStatus", () => {
  it.each([
    [ONLINE, "compact", `${T}.online`],
    [OFFLINE, "compact", `${T}.offline`],
    [HIDDEN, "compact", `${T}.hidden`],
    [ONLINE, "full", `${T}.online_now`],
    [OFFLINE, "full", `${T}.last_seen`],
    [NEVER_SEEN, "full", `${T}.offline`],
    [HIDDEN, "full", `${T}.hidden`],
  ] as const)("renders %o as a %s label", (presence, variant, label) => {
    const { container } = renderStatus(presence, variant);

    expect(container.textContent).toBe(label);
  });

  it("marks the last activity up as a time", () => {
    renderStatus(OFFLINE, "full");

    expect(screen.getByText(`${T}.last_seen`).tagName).toBe("TIME");
    expect(screen.getByText(`${T}.last_seen`).getAttribute("dateTime")).toBe(
      SEEN,
    );
  });

  it.each([
    [ONLINE, `${T}.online`],
    [OFFLINE, `${T}.offline`],
  ])("gives the dot an accessible name for %o", (presence, label) => {
    renderStatus(presence, "dot");

    expect(screen.getByRole("img", { name: label })).toBeTruthy();
  });

  it("renders no dot for a hidden member", () => {
    const { container } = renderStatus(HIDDEN, "dot");

    expect(container.childElementCount).toBe(0);
  });
});
