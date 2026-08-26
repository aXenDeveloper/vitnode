import type { Attribute, ThemeProviderProps } from "./theme-provider";

/**
 * Everything {@link ThemeProvider} does to the DOM, as one function that runs
 * before the first paint.
 *
 * Serialised into the page with `Function.prototype.toString()`, so it must
 * reference nothing but its own arguments: a closure over a module-level value
 * survives in this file and vanishes in the browser, where the value was never
 * defined. That is also why every option arrives as a parameter rather than
 * being read from a config.
 */
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

/**
 * The props of the no-flash script: the provider's, minus the two that only
 * describe the React side of the theme.
 */
export type ThemeScriptProps = Omit<
  ThemeProviderProps,
  "children" | "disableTransitionOnChange"
>;

/**
 * The script's source, ready for a `<script>` tag.
 *
 * Exported next to the component because a framework may want the string rather
 * than the element - and because it makes the script testable without a DOM
 * renderer, which is worth having for the one piece of code in VitNode that
 * runs before React exists.
 *
 * The defaults deliberately mirror {@link ThemeProvider}'s. The two read the
 * same `localStorage` key and write the same attributes, so a default that
 * drifts here is a theme flash: the script paints one theme and React replaces
 * it on hydration.
 */
export const themeScriptSource = ({
  attribute = "class",
  enableColorScheme = true,
  enableSystem = true,
  forcedTheme,
  storageKey = "theme",
  themes = ["light", "dark"],
  value,
  defaultTheme = enableSystem ? "system" : "light",
}: Omit<ThemeScriptProps, "nonce"> = {}): string =>
  `(${noFlashScript.toString()})(${JSON.stringify([
    attribute,
    storageKey,
    defaultTheme,
    forcedTheme,
    themes,
    value,
    enableSystem,
    enableColorScheme,
  ]).slice(1, -1)})`;

/**
 * The theme, applied to `<html>` before the browser paints anything.
 *
 * Without it the first frame is whatever the server rendered - light, always -
 * and the theme the visitor actually chose arrives a frame later as a flash of
 * the wrong colours.
 *
 * Framework-neutral on purpose: a TanStack Start app renders it in the document
 * head itself, and Next.js hoists it there through `useServerInsertedHTML` (see
 * `theme-script-next.tsx`). Both get the same script.
 */
export const ThemeScript = ({ nonce, ...props }: ThemeScriptProps) => (
  <script
    // eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml
    dangerouslySetInnerHTML={{ __html: themeScriptSource(props) }}
    nonce={typeof window === "undefined" ? nonce : ""}
    suppressHydrationWarning
  />
);
