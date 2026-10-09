// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { NotificationItemView } from "@/views/notifications/notifications-query";

import { notificationStateStore } from "@/views/notifications/notification-state-store";
import { recentNotificationsQueryOptions } from "@/views/notifications/notifications-query";

import { SESSION_QUERY_KEY } from "../auth/state";
import { NotificationsBell } from "./bell";

const USER_ID = 3;

const item = (
  overrides: Partial<NotificationItemView>,
): NotificationItemView => ({
  activitySeq: 2,
  actorCount: 0,
  actors: [],
  available: true,
  body: null,
  category: "social",
  createdAt: "2026-10-04T08:00:00.000Z",
  eventCount: 2,
  id: 11,
  lastActivityAt: "2026-10-04T08:00:00.000Z",
  pluginId: "@acme/test",
  readAt: null,
  subject: null,
  target: "/threads/1",
  title: "Two new replies",
  type: "test.reply",
  unread: true,
  ...overrides,
});

const mount = async () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(SESSION_QUERY_KEY, {
    user: { id: USER_ID, notifications: { revision: 4, unread: 2 } },
  });
  queryClient.setQueryData(
    recentNotificationsQueryOptions({ userId: USER_ID }).queryKey,
    {
      items: [
        item({}),
        item({ id: 12, target: null, title: "Older", unread: false }),
      ],
      nextCursor: null,
    },
  );

  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ["/"] }),
    routeTree: createRootRoute({ component: () => <NotificationsBell /> }),
  });

  render(
    <IntlProvider locale="en" messages={{}} timeZone="UTC">
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </IntlProvider>,
  );

  return await screen.findByRole("button", {
    name: "core.global.notifications.bell_label_unread",
  });
};

describe("NotificationsBell", () => {
  const fetchMock = vi.fn<typeof fetch>(
    async () =>
      await Promise.resolve(
        new Response(JSON.stringify({ revision: 5, unread: 1 }), {
          headers: { "content-type": "application/json" },
          status: 200,
        }),
      ),
  );

  beforeEach(() => {
    notificationStateStore.reset();
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the session's unread count without loading the inbox", async () => {
    await mount();

    expect(screen.getByTestId("notifications-badge").textContent).toBe("2");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never marks anything read just because the dropdown opened", async () => {
    const trigger = await mount();
    fireEvent.click(trigger);

    expect(await screen.findByText("Two new replies")).toBeTruthy();
    expect(screen.getByText("Older")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("notifications-badge").textContent).toBe("2");
  });

  it("marks an item read through the activity shown, when it is clicked", async () => {
    const trigger = await mount();
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByText("Two new replies"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string | URL, RequestInit];
    expect(String(url)).toMatch(/\/notifications\/11\/read$/);
    expect(init.method?.toUpperCase()).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ throughSeq: 2 });

    await waitFor(() =>
      expect(screen.getByTestId("notifications-badge").textContent).toBe("1"),
    );
  });
});
