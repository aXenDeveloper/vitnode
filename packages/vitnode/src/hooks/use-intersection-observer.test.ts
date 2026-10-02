import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useIntersectionObserver } from "./use-intersection-observer";

class FakeIntersectionObserver {
  constructor(
    callback: IntersectionObserverCallback,
    options: IntersectionObserverInit,
  ) {
    this.callback = callback;
    this.options = options;
    FakeIntersectionObserver.instances.push(this);
  }
  static instances: FakeIntersectionObserver[] = [];
  readonly callback: IntersectionObserverCallback;
  readonly disconnect = vi.fn();
  readonly observed: Element[] = [];
  readonly options: IntersectionObserverInit;

  observe(element: Element) {
    this.observed.push(element);
  }

  trigger(isIntersecting: boolean) {
    this.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

const latestObserver = () => FakeIntersectionObserver.instances.at(-1);

describe("useIntersectionObserver", () => {
  const element = document.createElement("div");
  const ref = { current: element };

  beforeEach(() => {
    FakeIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("observes the element with the given options", () => {
    renderHook(() =>
      useIntersectionObserver(ref, { rootMargin: "20px", threshold: 0.5 }),
    );

    expect(latestObserver()?.observed).toEqual([element]);
    expect(latestObserver()?.options).toMatchObject({
      rootMargin: "20px",
      threshold: [0.5],
    });
  });

  it("returns the latest entry", () => {
    const { result } = renderHook(() => useIntersectionObserver(ref));

    expect(result.current).toBeUndefined();

    act(() => {
      latestObserver()?.trigger(true);
    });
    expect(result.current?.isIntersecting).toBe(true);

    act(() => {
      latestObserver()?.trigger(false);
    });
    expect(result.current?.isIntersecting).toBe(false);
  });

  it("does not re-create the observer for a new threshold array", () => {
    const { rerender } = renderHook(() =>
      useIntersectionObserver(ref, { threshold: [0, 0.5, 1] }),
    );

    rerender();

    expect(FakeIntersectionObserver.instances).toHaveLength(1);
  });

  it("stops observing once visible when freezeOnceVisible is set", () => {
    const { result } = renderHook(() =>
      useIntersectionObserver(ref, { freezeOnceVisible: true }),
    );
    const observer = latestObserver();

    act(() => {
      observer?.trigger(true);
    });

    expect(observer?.disconnect).toHaveBeenCalled();
    expect(FakeIntersectionObserver.instances).toHaveLength(1);
    expect(result.current?.isIntersecting).toBe(true);
  });

  it("disconnects on unmount", () => {
    const { unmount } = renderHook(() => useIntersectionObserver(ref));

    unmount();

    expect(latestObserver()?.disconnect).toHaveBeenCalled();
  });

  it("does nothing when the browser has no IntersectionObserver", () => {
    vi.unstubAllGlobals();

    const { result } = renderHook(() => useIntersectionObserver(ref));

    expect("IntersectionObserver" in window).toBe(false);
    expect(result.current).toBeUndefined();
  });
});
