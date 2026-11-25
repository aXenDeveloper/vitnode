import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import React from "react";
import { useLocale, useTranslations } from "use-intl";

import { legalLinksQueryOptions } from "@/views/legal/legal-query";

import { RouteMessages } from "../i18n/route-messages";

interface LegalFooterLinksProps {
  className?: string;
  linkClassName?: string;
}

const Links = ({
  className,
  linkClassName = "text-muted-foreground hover:text-foreground underline-offset-4 hover:underline",
  items,
}: LegalFooterLinksProps & { items: { href: string; title: string }[] }) => {
  const t = useTranslations("core.legal.footer");

  return (
    <nav aria-label={t("label")}>
      <ul className={cn("flex flex-wrap gap-x-4 gap-y-2", className)}>
        {items.map(item => (
          <li key={item.href}>
            <Link className={linkClassName} to={item.href}>
              {item.title}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};

/**
 * Links to the published Terms of Service and Privacy Policy, titled as their
 * effective versions are, for a host app's footer. Renders nothing until a
 * document is published, and nothing while the links load. Universal.
 *
 * @example
 * ```tsx
 * import { LegalFooterLinks } from "@vitnode/core/tanstack/legal";
 *
 * <LegalFooterLinks className="text-sm" />;
 * ```
 */
export const LegalFooterLinks = (props: LegalFooterLinksProps) => {
  const locale = useLocale();
  const { data } = useQuery(legalLinksQueryOptions(locale));
  const items = [
    data?.terms ? { href: "/terms", title: data.terms.title } : null,
    data?.privacy ? { href: "/privacy", title: data.privacy.title } : null,
  ].filter(item => item !== null);
  if (items.length === 0) return null;

  return (
    <React.Suspense fallback={null}>
      <RouteMessages namespaces={["core.legal"]}>
        <Links {...props} items={items} />
      </RouteMessages>
    </React.Suspense>
  );
};
