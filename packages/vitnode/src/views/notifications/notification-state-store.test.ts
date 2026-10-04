import { describe, expect, it, vi } from "vitest";

import { createNotificationStateStore } from "./notification-state-store";

describe("notification state store", () => {
  it("only lets a newer revision replace the count", () => {
    const store = createNotificationStateStore();

    expect(store.apply(1, { revision: 5, unread: 3 })).toBe(true);
    // A WebSocket update overtook the session request that is now arriving.
    expect(store.apply(1, { revision: 7, unread: 4 })).toBe(true);
    expect(store.apply(1, { revision: 6, unread: 9 })).toBe(false);
    expect(store.apply(1, { revision: 7, unread: 9 })).toBe(false);

    expect(store.get()).toEqual({ revision: 7, unread: 4, userId: 1 });
  });

  it("starts over for another user, whatever their revision", () => {
    const store = createNotificationStateStore();
    store.apply(1, { revision: 50, unread: 3 });

    expect(store.apply(2, { revision: 1, unread: 0 })).toBe(true);
    expect(store.get()).toEqual({ revision: 1, unread: 0, userId: 2 });
  });

  it("never shows a negative count and notifies subscribers once per change", () => {
    const store = createNotificationStateStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.apply(1, { revision: 1, unread: -2 });
    store.apply(1, { revision: 1, unread: 5 });
    store.reset();
    store.reset();

    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.get()).toBeNull();
  });
});
