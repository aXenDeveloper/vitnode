import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useLocalStorage } from "./use-local-storage";

describe("useLocalStorage", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns the default value when nothing is stored", () => {
    const { result } = renderHook(() => useLocalStorage("theme", "light"));

    expect(result.current[0]).toBe("light");
    expect(window.localStorage.getItem("theme")).toBeNull();
  });

  it("reads a value that is already stored", () => {
    window.localStorage.setItem("count", "5");

    const { result } = renderHook(() => useLocalStorage("count", 0));

    expect(result.current[0]).toBe(5);
  });

  it("persists new values as JSON", () => {
    const { result } = renderHook(() =>
      useLocalStorage("user", { name: "Ada" }),
    );

    act(() => {
      result.current[1]({ name: "Grace" });
    });

    expect(result.current[0]).toEqual({ name: "Grace" });
    expect(window.localStorage.getItem("user")).toBe('{"name":"Grace"}');
  });

  it("passes the latest value to an updater function", () => {
    const { result } = renderHook(() => useLocalStorage("count", 0));

    act(() => {
      result.current[1](previous => previous + 1);
      result.current[1](previous => previous + 1);
    });

    expect(result.current[0]).toBe(2);
  });

  it("keeps hooks with the same key in sync", () => {
    const first = renderHook(() => useLocalStorage("count", 0));
    const second = renderHook(() => useLocalStorage("count", 0));

    act(() => {
      first.result.current[1](7);
    });

    expect(second.result.current[0]).toBe(7);
  });

  it("picks up changes made in another tab", () => {
    const { result } = renderHook(() => useLocalStorage("count", 0));

    act(() => {
      window.localStorage.setItem("count", "3");
      window.dispatchEvent(new StorageEvent("storage", { key: "count" }));
    });

    expect(result.current[0]).toBe(3);
  });

  it("falls back to the default when the stored value is not JSON", () => {
    window.localStorage.setItem("count", "not json");

    const { result } = renderHook(() => useLocalStorage("count", 0));

    expect(result.current[0]).toBe(0);
  });

  it("removes the value and goes back to the default", () => {
    window.localStorage.setItem("count", "9");
    const { result } = renderHook(() => useLocalStorage("count", 0));

    act(() => {
      result.current[2]();
    });

    expect(result.current[0]).toBe(0);
    expect(window.localStorage.getItem("count")).toBeNull();
  });

  it("keeps working in memory when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const { result } = renderHook(() => useLocalStorage("blocked", "a"));

    act(() => {
      result.current[1]("b");
    });

    expect(result.current[0]).toBe("b");
  });

  it("shows the in-memory value when storage is readable but full", () => {
    window.localStorage.setItem("full", '"stored"');
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const { result } = renderHook(() => useLocalStorage("full", "default"));

    act(() => {
      result.current[1]("updated");
    });
    expect(result.current[0]).toBe("updated");

    act(() => {
      result.current[2]();
    });
    expect(result.current[0]).toBe("default");

    setItem.mockRestore();
    act(() => {
      result.current[1]("saved");
    });
    expect(result.current[0]).toBe("saved");
    expect(window.localStorage.getItem("full")).toBe('"saved"');
  });
});
