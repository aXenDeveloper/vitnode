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
  const load = () => {
    for (const href of preloads) {
      const link = document.createElement("link");
      link.rel = "modulepreload";
      link.href = href;
      document.head.append(link);
    }

    for (const src of entries) {
      const script = document.createElement("script");
      script.type = "module";
      script.src = src;
      document.body.append(script);
    }
  };

  if (document.visibilityState === "hidden") {
    load();

    return;
  }

  requestAnimationFrame(() => {
    setTimeout(load, 0);
  });
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
