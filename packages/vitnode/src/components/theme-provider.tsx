"use client";

import { useServerInsertedHTML } from "next/navigation";
import * as React from "react";

const MEDIA = "(prefers-color-scheme: dark)";
const colorSchemes = ["light", "dark"];

type Attribute = "class" | `data-${string}`;

export interface ThemeProviderProps {
  /** HTML attribute(s) used to apply the theme. @defaultValue `"class"` */
  attribute?: Attribute | Attribute[];
  children?: React.ReactNode;
  /** Default theme name. @defaultValue `enableSystem ? "system" : "light"` */
  defaultTheme?: string;
  /** Disable CSS transitions while the theme is switching. */
  disableTransitionOnChange?: boolean;
  /** Whether to set the `color-scheme` style on the document. */
  enableColorScheme?: boolean;
  /** Whether to switch between dark/light based on system preference. */
  enableSystem?: boolean;
  /** Forced theme name — disables switching. */
  forcedTheme?: string;
  /** Nonce passed to the injected no-flash script (CSP). */
  nonce?: string;
  /** Key used to persist the theme in `localStorage`. @defaultValue `"theme"` */
  storageKey?: string;
  /** List of available theme names. */
  themes?: string[];
  /** Map of theme name -> applied attribute value. */
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

const noFlashScript = (
  attribute: Attribute | Attribute[],
  storageKey: string,
  defaultTheme: string,
  forcedTheme: string | undefined,
  themes: string[],
  value: Record<string, string> | undefined,
  enableSystem: boolean,
  enableColorScheme: boolean,
) => {
  const el = document.documentElement;
  const systemThemes = ["light", "dark"];

  const setColorScheme = (theme: string) => {
    if (enableColorScheme && systemThemes.includes(theme)) {
      el.style.colorScheme = theme;
    }
  };

  const updateDOM = (theme: string) => {
    const attributes = Array.isArray(attribute) ? attribute : [attribute];
    attributes.forEach(attr => {
      const isClass = attr === "class";
      const classes =
        isClass && value ? themes.map(t => value[t] ?? t) : themes;
      if (isClass) {
        el.classList.remove(...classes);
        el.classList.add(value?.[theme] ?? theme);
      } else {
        el.setAttribute(attr, theme);
      }
    });
    setColorScheme(theme);
  };

  if (forcedTheme) {
    updateDOM(forcedTheme);

    return;
  }

  try {
    const stored = localStorage.getItem(storageKey) ?? defaultTheme;
    const isSystem = enableSystem && stored === "system";
    const resolved = isSystem
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : (value?.[stored] ?? stored);
    updateDOM(resolved);
  } catch {
    // ignore
  }
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

export const ThemeProvider = ({
  attribute = "class",
  children,
  disableTransitionOnChange = false,
  enableColorScheme = true,
  enableSystem = true,
  forcedTheme,
  nonce,
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
      const enable = disableTransitionOnChange ? disableTransitions() : null;
      const attrs = Array.isArray(attribute) ? attribute : [attribute];

      attrs.forEach(attr => {
        if (attr === "class") {
          const classes = value ? themes.map(t => value[t] ?? t) : [...themes];
          el.classList.remove(...classes);
          el.classList.add(value?.[resolved] ?? resolved);
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

  // Apply the theme to the DOM whenever the resolved value changes.
  React.useEffect(() => {
    applyTheme(forcedTheme ?? theme);
  }, [applyTheme, forcedTheme, theme, systemTheme]);

  // Sync across tabs.
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

  useServerInsertedHTML(() => (
    <script
      // eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml
      dangerouslySetInnerHTML={{
        __html: `(${noFlashScript.toString()})(${JSON.stringify([
          attribute,
          storageKey,
          defaultTheme,
          forcedTheme,
          themes,
          value,
          enableSystem,
          enableColorScheme,
        ]).slice(1, -1)})`,
      }}
      key="vitnode-theme-script"
      nonce={typeof window === "undefined" ? nonce : ""}
      suppressHydrationWarning
    />
  ));

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
