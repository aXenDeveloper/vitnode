import type { VitNodeConfig } from "@/vitnode.config";

import { LanguageSwitcher } from "@/components/switchers/langs/language-switcher";
import { Link } from "@/lib/navigation";

import { SidebarAdminContent } from "./sidebar-content";

/**
 * {@link SidebarAdminContent}, wired to Next.js.
 *
 * Supplies the two things the shared frame refuses to decide: `next-intl`'s
 * locale-aware `Link`, and this framework's language switcher - which is only
 * rendered when the install actually has a second language to switch to.
 */
export const SidebarAdmin = ({
  children,
  vitNodeConfig,
}: {
  children: React.ReactNode;
  vitNodeConfig: VitNodeConfig;
}) => (
  <SidebarAdminContent
    languageSwitcher={
      vitNodeConfig.i18n.locales.length > 1 ? (
        <LanguageSwitcher locales={vitNodeConfig.i18n.locales} />
      ) : undefined
    }
    LinkComponent={Link}
  >
    {children}
  </SidebarAdminContent>
);
