import { act, render } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider, useTheme } from "./theme-provider";
import { ThemeScript, themeScriptSource } from "./theme-script";

/**
 * jsdom ships no `matchMedia`, and both halves of the theme system ask it what
 * the operating system prefers.
 */
const mockSystemTheme = (prefersDark: boolean) => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      addEventListener: vi.fn(),
      matches: prefersDark,
      removeEventListener: vi.fn(),
    })),
  );
};

/** Runs the no-flash script the way the browser runs it: as inline source. */
const runThemeScript = (
  props?: Parameters<typeof themeScriptSource>[0],
): void => {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function(themeScriptSource(props))();
};

const html = () => document.documentElement;

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  html().className = "";
  html().removeAttribute("style");
  html().removeAttribute("data-theme");
});

describe("ThemeScript", () => {
  it("applies the stored theme to <html> before React renders", () => {
    localStorage.setItem("theme", "dark");
    mockSystemTheme(false);

    runThemeScript();

    expect(html().classList.contains("dark")).toBe(true);
    expect(html().style.colorScheme).toBe("dark");
  });

  it("resolves the system theme when nothing is stored", () => {
    mockSystemTheme(true);

    runThemeScript();

    expect(html().classList.contains("dark")).toBe(true);
  });

  it("honours a forced theme over anything stored", () => {
    localStorage.setItem("theme", "dark");
    mockSystemTheme(true);

    runThemeScript({ forcedTheme: "light" });

    expect(html().classList.contains("light")).toBe(true);
    expect(html().classList.contains("dark")).toBe(false);
  });

  it("writes an attribute instead of a class when asked to", () => {
    localStorage.setItem("theme", "dark");
    mockSystemTheme(false);

    runThemeScript({ attribute: "data-theme" });

    expect(html().getAttribute("data-theme")).toBe("dark");
  });

  it("reads the storage key it is given", () => {
    localStorage.setItem("vitnode-theme", "dark");
    mockSystemTheme(false);

    runThemeScript({ storageKey: "vitnode-theme" });

    expect(html().classList.contains("dark")).toBe(true);
  });

  it("survives a browser that refuses localStorage", () => {
    mockSystemTheme(false);
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });

    expect(() => {
      runThemeScript();
    }).not.toThrow();

    getItem.mockRestore();
  });

  it("renders as a script tag carrying that source", () => {
    const { container } = render(<ThemeScript nonce="abc123" />);
    const script = container.querySelector("script");

    expect(script?.innerHTML).toBe(themeScriptSource());
    // Client renders send no nonce: the header's nonce belongs to the server
    // response the script was inlined into.
    expect(script?.getAttribute("nonce")).toBe("");
  });
});

const ThemeReadout = () => {
  const { resolvedTheme, theme } = useTheme();

  return <span data-testid="theme">{`${theme}:${resolvedTheme}`}</span>;
};

/**
 * The React half, which now imports nothing from `next/*`.
 *
 * The assertions are the behaviour the extraction had to preserve, not the
 * implementation: `localStorage` is still the source of truth, the system theme
 * is still followed, and the class the provider settles on is still the class the
 * script painted.
 */
describe("ThemeProvider", () => {
  it("applies the stored theme, matching what the script painted", () => {
    localStorage.setItem("theme", "dark");
    mockSystemTheme(false);

    runThemeScript();
    const painted = html().className;
    html().className = "";

    render(
      <ThemeProvider attribute="class" enableSystem>
        <ThemeReadout />
      </ThemeProvider>,
    );

    expect(html().className).toBe(painted);
  });

  it("follows the system theme when set to system", () => {
    localStorage.setItem("theme", "system");
    mockSystemTheme(true);

    const { getByTestId } = render(
      <ThemeProvider attribute="class" enableSystem>
        <ThemeReadout />
      </ThemeProvider>,
    );

    expect(getByTestId("theme").textContent).toBe("system:dark");
    expect(html().classList.contains("dark")).toBe(true);
  });

  it("persists a chosen theme to localStorage", () => {
    mockSystemTheme(false);

    const Switcher = () => {
      const { setTheme } = useTheme();

      return (
        <button
          onClick={() => {
            setTheme("dark");
          }}
          type="button"
        >
          dark
        </button>
      );
    };

    const { getByRole } = render(
      <ThemeProvider attribute="class" enableSystem>
        <Switcher />
      </ThemeProvider>,
    );

    act(() => {
      getByRole("button").click();
    });

    expect(localStorage.getItem("theme")).toBe("dark");
    expect(html().classList.contains("dark")).toBe(true);
  });

  it("renders no script of its own - the shell owns that", () => {
    mockSystemTheme(false);

    const { container } = render(
      <ThemeProvider>
        <span>content</span>
      </ThemeProvider>,
    );

    expect(container.querySelector("script")).toBeNull();
  });
});
