import { Link } from "@tanstack/react-router";

import { isExternalHref } from "./normalize-url";

export interface AdminLinkProps extends Omit<
  React.ComponentProps<"a">,
  "href"
> {
  href: string;
}

export const AdminLink = ({ href, ...props }: AdminLinkProps) =>
  isExternalHref(href) ? (
    <a href={href} {...props} />
  ) : (
    <Link {...props} to={href} />
  );
