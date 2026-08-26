"use client";

import { useServerInsertedHTML } from "next/navigation";

import type { ThemeScriptProps } from "./theme-script";

import { ThemeScript } from "./theme-script";

/**
 * {@link ThemeScript}, inserted the way Next.js wants it inserted.
 *
 * `useServerInsertedHTML` is the App Router's only way to get markup into
 * `<head>` from a component that is not the layout, and the layout is exactly
 * where this cannot live: the theme is configured by the provider tree, not by
 * the document. It is also the one Next.js-specific line the theme system needs,
 * which is why it is the whole of this file - `ThemeProvider` and `ThemeScript`
 * import nothing from `next/*` and work in any React app.
 *
 * Renders nothing itself: the script it hands Next.js is emitted once during the
 * server render, before the first paint, and the client never re-inserts it.
 */
export const NextThemeScript = (props: ThemeScriptProps) => {
  useServerInsertedHTML(() => (
    <ThemeScript key="vitnode-theme-script" {...props} />
  ));

  return null;
};
