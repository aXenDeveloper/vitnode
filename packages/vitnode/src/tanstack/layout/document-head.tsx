import type { RouterManagedTag } from "@tanstack/router-core";

import { Asset, HeadContent, useRouter, useTags } from "@tanstack/react-router";

import { DEV_ERROR_CLIENT_URL } from "@/framework/dev-error/report-route";

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
      // oxlint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml
      dangerouslySetInnerHTML={{ __html: tag.children }}
      suppressHydrationWarning
    />
  ) : (
    <Asset {...tag} nonce={nonce} />
  );

const HeadContentWithoutPreloads = () => {
  const tags = useTags();
  const nonce = useRouter().options.ssr?.nonce;

  return (
    <>
      {tags
        .filter(tag => !isModulePreload(tag))
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

/**
 * The root document's `<head>` tags, in place of TanStack Router's
 * `<HeadContent />`. In production it leaves out module preloads, which
 * `DocumentScripts` adds after first paint. In development it also loads the
 * client that shows Vite's build errors on VitNode's error page.
 */
export const DocumentHead = () =>
  process.env.NODE_ENV === "production" ? (
    <HeadContentWithoutPreloads />
  ) : (
    <>
      <HeadContent />
      <script src={DEV_ERROR_CLIENT_URL} type="module" />
    </>
  );
