import type { RouterManagedTag } from "@tanstack/router-core";

import { Asset, Scripts, useRouter, useTags } from "@tanstack/react-router";
import {
  composeSsrBodyScripts,
  getSsrBodyScriptParts,
} from "@tanstack/router-core";
import { useState } from "react";

const ROUTE_SCRIPT_ATTRS = { suppressHydrationWarning: true };

const moduleEntrySrc = (tag: RouterManagedTag) =>
  tag.tag === "script" &&
  tag.attrs?.type === "module" &&
  typeof tag.attrs.src === "string"
    ? tag.attrs.src
    : undefined;

const modulePreloadHref = (tag: RouterManagedTag) =>
  tag.tag === "link" &&
  tag.attrs?.rel === "modulepreload" &&
  typeof tag.attrs.href === "string"
    ? tag.attrs.href
    : undefined;

const loadAfterFirstPaint = (entries: string[], preloads: string[]) => {
  let isLoaded = false;
  const load = () => {
    if (isLoaded) return;
    isLoaded = true;

    const batchSize = 40;
    const appendFrom = (start: number) => {
      const batch = document.createDocumentFragment();

      for (const href of preloads.slice(start, start + batchSize)) {
        const link = document.createElement("link");
        link.rel = "modulepreload";
        link.href = href;
        batch.append(link);
      }

      document.head.append(batch);

      if (start + batchSize < preloads.length) {
        setTimeout(() => {
          appendFrom(start + batchSize);
        }, 0);

        return;
      }

      for (const src of entries) {
        const script = document.createElement("script");
        script.type = "module";
        script.src = src;
        document.body.append(script);
      }
    };

    appendFrom(0);
  };

  if (document.visibilityState === "hidden") {
    load();

    return;
  }

  if (
    typeof PerformanceObserver !== "function" ||
    !PerformanceObserver.supportedEntryTypes.includes("paint")
  ) {
    requestAnimationFrame(() => {
      setTimeout(load, 0);
    });

    return;
  }

  new PerformanceObserver((list, observer) => {
    if (list.getEntriesByName("first-contentful-paint").length === 0) return;

    observer.disconnect();
    setTimeout(load, 0);
  }).observe({ buffered: true, type: "paint" });
  document.addEventListener("visibilitychange", load, { once: true });
  setTimeout(load, 3000);
};

const loaderSource = (entries: string[], preloads: string[]) =>
  `(${loadAfterFirstPaint.toString()})(${JSON.stringify([entries, preloads])
    .slice(1, -1)
    .replaceAll("<", "\\u003c")})`;

const DeferredScripts = () => {
  const router = useRouter();
  const headTags = useTags();
  const nonce = router.options.ssr?.nonce;
  const [scripts] = useState(() =>
    composeSsrBodyScripts(
      getSsrBodyScriptParts(
        router.stores.matches.get(),
        router.ssr?.manifest,
        nonce,
        ROUTE_SCRIPT_ATTRS,
      ),
      router.serverSsr?.takeInitialHydrationScriptTags(),
    ),
  );
  const [loader] = useState(() => {
    const entries = scripts.flatMap(script => moduleEntrySrc(script) ?? []);

    return entries.length > 0
      ? loaderSource(
          entries,
          headTags.flatMap(tag => modulePreloadHref(tag) ?? []),
        )
      : undefined;
  });

  return (
    <>
      {scripts
        .filter(script => moduleEntrySrc(script) === undefined)
        .map(script => (
          <Asset key={`tsr-scripts-${JSON.stringify(script)}`} {...script} />
        ))}
      {loader ? (
        <script
          // oxlint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml
          dangerouslySetInnerHTML={{ __html: loader }}
          nonce={typeof window === "undefined" ? nonce : ""}
          suppressHydrationWarning
        />
      ) : null}
    </>
  );
};

export const DocumentScripts = () =>
  process.env.NODE_ENV === "production" ? <DeferredScripts /> : <Scripts />;
