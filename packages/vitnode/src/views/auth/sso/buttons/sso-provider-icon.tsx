import { createElement, isValidElement } from "react";

import type { SSOProvider } from "../providers";

import { ssoIcon } from "../icons";

export const SSOProviderIcon = ({ provider }: { provider: SSOProvider }) => {
  const custom = ssoIcon(provider.id);

  if (custom) {
    return isValidElement(custom)
      ? custom
      : createElement(custom, { className: "size-4" });
  }

  if (!provider.icon) return null;

  if (provider.icon.kind === "image") {
    return (
      <img
        alt=""
        aria-hidden
        className="size-4 object-contain"
        src={provider.icon.src}
      />
    );
  }

  return (
    <span
      aria-hidden
      className="inline-flex size-4 shrink-0 items-center justify-center [&>svg]:size-full"
      // oxlint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml
      dangerouslySetInnerHTML={{ __html: provider.icon.markup }}
    />
  );
};
