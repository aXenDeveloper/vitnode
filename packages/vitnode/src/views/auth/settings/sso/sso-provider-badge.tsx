import type { SSOProvider } from "../../sso/providers";

import { SSOProviderIcon } from "../../sso/buttons/sso-provider-icon";
import { ssoIcon } from "../../sso/icons";

export const SsoProviderMark = ({ provider }: { provider: SSOProvider }) => (
  <div
    aria-hidden="true"
    className="bg-muted/60 text-foreground ring-foreground/10 flex size-10 shrink-0 items-center justify-center rounded-md text-sm font-semibold ring-1 [&_img]:size-5 [&_svg]:size-5 [&>span]:size-5"
  >
    {provider.icon || ssoIcon(provider.id) ? (
      <SSOProviderIcon provider={provider} />
    ) : (
      provider.name.charAt(0).toUpperCase()
    )}
  </div>
);
