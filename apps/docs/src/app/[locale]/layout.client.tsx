"use client";

import { useParams } from "next/navigation";
import { useLayoutEffect } from "react";

/**
 * Keeps the docs section class (`dev`, `guides`, `plugins`, `ui`) on `<body>` in
 * sync with the route. The class sets `--color-fd-primary`, so it has to live on
 * `<body>` - an element that cannot be wrapped in `<Suspense>`.
 *
 * First paint is handled by the inline script in the root layout, which derives
 * the same class from `location.pathname` before anything renders. This takes
 * over from there, so client navigations between sections repaint correctly.
 * Renders nothing.
 */
export function DocsModeSync(): null {
  const { slug } = useParams();
  const mode = Array.isArray(slug) && slug.length > 0 ? slug[0] : undefined;

  useLayoutEffect(() => {
    if (typeof mode !== "string" || mode.length === 0) return;

    document.body.classList.add(mode);

    return () => {
      document.body.classList.remove(mode);
    };
  }, [mode]);

  return null;
}
