import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { isExternalHref } from "./normalize-url";

const ExternalLink: AuthLinkComponent = props => <a {...props} />;

export const adminLinkFor = (
  href: string,
  LinkComponent: AuthLinkComponent,
): AuthLinkComponent => (isExternalHref(href) ? ExternalLink : LinkComponent);
