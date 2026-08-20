"use client";

import { useParams, useServerInsertedHTML } from "next/navigation";
import { useLayoutEffect } from "react";

/**
 * Paints the docs section class (`dev`, `guides`, `plugins`, `ui`) on `<html>`
 * before first paint.
 *
 * The class sets `--color-fd-primary`, so it has to sit on an ancestor of the
 * whole shell. `<body>` cannot be wrapped in `<Suspense>`, so the class cannot
 * come from a `useParams()` read during prerendering without making every route
 * block - deriving it from `location.pathname` here keeps the shell static.
 *
 * `useServerInsertedHTML` keeps the tag out of React's render tree: it is
 * emitted into the streamed `<head>` on the server and is a no-op on the
 * client, so React never renders a `<script>` during a client render (which it
 * warns about, and which would never execute anyway).
 */
const docsModeScript = `(function(){var p=location.pathname.split("/"),i=p.indexOf("docs"),m=i<0?"":p[i+1];if(m)document.documentElement.classList.add(m)})()`;

export function DocsModeScript(): null {
  useServerInsertedHTML(() => (
    <script
      // eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml
      dangerouslySetInnerHTML={{ __html: docsModeScript }}
      key="docs-mode-script"
      suppressHydrationWarning
    />
  ));

  return null;
}

/**
 * Keeps the docs section class on `<html>` in sync with the route.
 *
 * First paint is handled by `DocsModeScript` above, which derives the same
 * class from `location.pathname` before anything renders. This takes over from
 * there, so client navigations between sections repaint correctly.
 * Renders nothing.
 */
export function DocsModeSync(): null {
  const { slug } = useParams();
  const mode = Array.isArray(slug) && slug.length > 0 ? slug[0] : undefined;

  useLayoutEffect(() => {
    if (typeof mode !== "string" || mode.length === 0) return;

    document.documentElement.classList.add(mode);

    return () => {
      document.documentElement.classList.remove(mode);
    };
  }, [mode]);

  return null;
}
