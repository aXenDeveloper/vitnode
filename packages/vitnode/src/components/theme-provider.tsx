"use client";

import React from "react";

const MEDIA = "(prefers-color-scheme: dark)";
const colorSchemes = ["light", "dark"];

export type Attribute = "class" | `data-${string}`;

export interface ThemeProviderProps {
  attribute?: Attribute | Attribute[];
  children?: React.ReactNode;
  defaultTheme?: string;
  disableTransitionOnChange?: boolean;
  enableColorScheme?: boolean;
  enableSystem?: boolean;
  forcedTheme?: string;
  /** Read by {@link ThemeScript}, which is what renders a `<script>`. */
  nonce?: string;
  storageKey?: string;
  themes?: string[];
  value?: Record<string, string>;
}

export interface UseThemeReturn {
  resolvedTheme: string | undefined;
  setTheme: (theme: React.SetStateAction<string | undefined>) => void;
  systemTheme: "dark" | "light" | undefined;
  theme: string | undefined;
  themes: string[];
}

const ThemeContext = React.createContext<undefined | UseThemeReturn>(undefined);

const defaultContext: UseThemeReturn = {
  resolvedTheme: undefined,
  setTheme: () => {},
  systemTheme: undefined,
  theme: undefined,
  themes: [],
};

export const useTheme = (): UseThemeReturn =>
  React.use(ThemeContext) ?? defaultContext;

const isServer = typeof window === "undefined";

const getSystemTheme = (): "dark" | "light" => {
  if (isServer) return "light";

  return window.matchMedia(MEDIA).matches ? "dark" : "light";
};

const subscribeSystemTheme = (callback: () => void): (() => void) => {
  const media = window.matchMedia(MEDIA);
  media.addEventListener("change", callback);

  return () => {
    media.removeEventListener("change", callback);
  };
};

const getServerSystemTheme = (): undefined => undefined;

const getStoredTheme = (
  storageKey: string,
  fallback?: string,
): string | undefined => {
  if (isServer) return undefined;
  let stored: string | undefined;
  try {
    stored = window.localStorage.getItem(storageKey) ?? undefined;
  } catch {
    // localStorage unavailable (private mode etc.)
  }

  return stored ?? fallback;
};

const disableTransitions = (): (() => void) => {
  const css = document.createElement("style");
  css.appendChild(
    document.createTextNode(
      "*,*::before,*::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}",
    ),
  );
  document.head.appendChild(css);

  return () => {
    // Force a reflow so the transition-disabling style is fully applied…
    (() => window.getComputedStyle(document.body))();
    // …then remove it on the next tick.
    setTimeout(() => {
      document.head.removeChild(css);
    }, 1);
  };
};

/**
 * The theme, as React state: what it is set to, what that resolves to once the
 * system preference is known, and the class or attribute that puts it on
 * `<html>`.
 *
 * Framework-free - it is mounted by the Next.js app and the TanStack Start app
 * alike. The one piece that is not React, the script that paints the theme
 * before the first frame, lives in `theme-script.tsx` and is rendered by whatever
 * owns the document.
 */
export const ThemeProvider = ({
  attribute = "class",
  children,
  disableTransitionOnChange = false,
  enableColorScheme = true,
  enableSystem = true,
  forcedTheme,
  storageKey = "theme",
  themes = ["light", "dark"],
  value,
  defaultTheme = enableSystem ? "system" : "light",
}: ThemeProviderProps) => {
  // eslint-disable-next-line @eslint-react/use-state
  const [theme, setThemeState] = React.useState<string | undefined>(() =>
    getStoredTheme(storageKey, defaultTheme),
  );
  const systemTheme = React.useSyncExternalStore(
    subscribeSystemTheme,
    getSystemTheme,
    getServerSystemTheme,
  );

  const resolvedTheme =
    forcedTheme ?? (theme === "system" ? systemTheme : theme);

  const applyTheme = React.useCallback(
    (next: string | undefined) => {
      if (!next) return;
      const resolved = next === "system" ? getSystemTheme() : next;
      const el = document.documentElement;
      const attrs = Array.isArray(attribute) ? attribute : [attribute];
      const applied = value?.[resolved] ?? resolved;
      const alreadyApplied = attrs.every(attr =>
        attr === "class"
          ? el.classList.contains(applied)
          : el.getAttribute(attr) === resolved,
      );

      if (alreadyApplied) return;

      const enable = disableTransitionOnChange ? disableTransitions() : null;

      attrs.forEach(attr => {
        if (attr === "class") {
          const classes = value ? themes.map(t => value[t] ?? t) : [...themes];
          el.classList.remove(...classes);
          el.classList.add(applied);
        } else {
          el.setAttribute(attr, resolved);
        }
      });

      if (enableColorScheme && colorSchemes.includes(resolved)) {
        el.style.colorScheme = resolved;
      }
      enable?.();
    },
    [attribute, disableTransitionOnChange, enableColorScheme, themes, value],
  );

  const setTheme = React.useCallback(
    (next: React.SetStateAction<string | undefined>) => {
      setThemeState(prev => {
        const resolved = typeof next === "function" ? next(prev) : next;
        try {
          if (resolved === undefined) {
            window.localStorage.removeItem(storageKey);
          } else {
            window.localStorage.setItem(storageKey, resolved);
          }
        } catch {
          // localStorage unavailable
        }

        return resolved;
      });
    },
    [storageKey],
  );

  React.useEffect(() => {
    applyTheme(forcedTheme ?? theme);
  }, [applyTheme, forcedTheme, theme, systemTheme]);

  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== storageKey) return;
      setThemeState(e.newValue ?? defaultTheme);
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, [defaultTheme, storageKey]);

  const contextValue = React.useMemo<UseThemeReturn>(
    () => ({ resolvedTheme, setTheme, systemTheme, theme, themes }),
    [resolvedTheme, setTheme, systemTheme, theme, themes],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};
