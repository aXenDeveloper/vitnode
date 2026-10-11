import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useIsMobile } from "./use-mobile";

const stubViewport = (initiallyMobile: boolean) => {
  let matches = initiallyMobile;
  const listeners = new Set<() => void>();

  vi.stubGlobal("matchMedia", (query: string) => ({
    addEventListener: (_type: string, listener: () => void) => {
      listeners.add(listener);
    },
    get matches() {
      return matches;
    },
    media: query,
    removeEventListener: (_type: string, listener: () => void) => {
      listeners.delete(listener);
    },
  }));

  return {
    resize: (mobile: boolean) => {
      matches = mobile;
      for (const listener of listeners) listener();
    },
  };
};

const Probe = () => <span>{useIsMobile() ? "mobile" : "desktop"}</span>;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useIsMobile", () => {
  it("is right on the very first client render, with no desktop flash", () => {
    stubViewport(true);
    const seen: boolean[] = [];
    const Recorder = () => {
      seen.push(useIsMobile());

      return null;
    };

    render(<Recorder />);

    expect(seen.every(Boolean)).toBe(true);
  });

  it("follows the viewport as it crosses the breakpoint", () => {
    const viewport = stubViewport(false);
    render(<Probe />);
    expect(screen.getByText("desktop")).toBeDefined();

    act(() => {
      viewport.resize(true);
    });

    expect(screen.getByText("mobile")).toBeDefined();
  });

  it("renders as desktop on the server", () => {
    stubViewport(true);

    expect(renderToString(<Probe />)).toContain("desktop");
  });
});
