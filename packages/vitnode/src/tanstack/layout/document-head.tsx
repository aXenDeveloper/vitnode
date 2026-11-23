import type { RouterManagedTag } from "@tanstack/router-core";

import { Asset, useHydrated, useRouter, useTags } from "@tanstack/react-router";
import { DEV_STYLES_ATTR } from "@tanstack/router-core";
import { useEffect } from "react";

import { DEV_ERROR_CLIENT_URL } from "@/framework/dev-error/report-route";

import { isOgLocaleAlternateName } from "../metadata/og-locale-alternate";

const isModulePreload = (tag: RouterManagedTag) =>
  tag.tag === "link" && tag.attrs?.rel === "modulepreload";

const isDataScript = (tag: RouterManagedTag) =>
  tag.tag === "script" &&
  typeof tag.attrs?.type === "string" &&
  !["", "module", "text/javascript"].includes(tag.attrs.type);

const HeadTag = ({
  nonce,
  tag,
}: {
  nonce: string | undefined;
  tag: RouterManagedTag;
}) =>
  isDataScript(tag) && typeof tag.children === "string" ? (
    <script
      {...tag.attrs}
      // oxlint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: tag.children }}
      suppressHydrationWarning
    />
  ) : (
    <Asset {...tag} nonce={nonce} />
  );

const withoutDedupeName = (tag: RouterManagedTag): RouterManagedTag => {
  if (tag.tag !== "meta" || !isOgLocaleAlternateName(tag.attrs?.name)) {
    return tag;
  }

  const { name: _name, ...attrs } = tag.attrs ?? {};

  return { ...tag, attrs };
};

const HeadContentWithoutPreloads = () => {
  const tags = useTags();
  const nonce = useRouter().options.ssr?.nonce;

  return (
    <>
      {tags
        .filter(tag => !isModulePreload(tag))
        .map(withoutDedupeName)
        .map(tag => (
          <HeadTag
            key={`tsr-meta-${JSON.stringify(tag)}`}
            nonce={nonce}
            tag={tag}
          />
        ))}
    </>
  );
};

const isDevStylesLink = (tag: RouterManagedTag) =>
  tag.tag === "link" && tag.attrs?.[DEV_STYLES_ATTR] === true;

const DevHeadContent = () => {
  const tags = useTags();
  const nonce = useRouter().options.ssr?.nonce;
  const hydrated = useHydrated();

  useEffect(() => {
    if (!hydrated) return;
    for (const link of document.querySelectorAll(`link[${DEV_STYLES_ATTR}]`)) {
      link.remove();
    }
  }, [hydrated]);

  return (
    <>
      {tags
        .filter(tag => !(hydrated && isDevStylesLink(tag)))
        .map(withoutDedupeName)
        .map(tag => (
          <Asset
            {...tag}
            key={`tsr-meta-${JSON.stringify(tag)}`}
            nonce={nonce}
          />
        ))}
    </>
  );
};

/**
 * The root document's `<head>` tags, in place of TanStack Router's
 * `<HeadContent />`. In production it leaves out module preloads, which
 * `DocumentScripts` adds after first paint. In development it also loads the
 * client that shows Vite's build errors on VitNode's error page. Either way
 * it drops the placeholder `name` that keeps each `og:locale:alternate` tag
 * from being deduplicated by the router.
 */
export const DocumentHead = () =>
  process.env.NODE_ENV === "production" ? (
    <HeadContentWithoutPreloads />
  ) : (
    <>
      <DevHeadContent />
      <script src={DEV_ERROR_CLIENT_URL} type="module" />
    </>
  );
