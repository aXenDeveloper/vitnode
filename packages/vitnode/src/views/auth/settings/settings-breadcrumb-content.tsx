import { useTranslations } from "use-intl";

import type { AuthLinkComponent } from "../auth-link";
import type { SettingsNavKey } from "./settings-nav";

import { BreadcrumbMainContent } from "../../breadcrumb/breadcrumb-main-content";
import { SETTINGS_ROOT_HREF, settingsNavHref } from "./settings-nav";

export interface SettingsBreadcrumbContentProps {
  LinkComponent: AuthLinkComponent;
  /** The panel this crumb is for. Absent is the settings root's own trail. */
  navKey?: SettingsNavKey;
}

/**
 * The settings breadcrumb, framework-free.
 *
 * The trail is derived rather than written down: the href comes from the
 * navigation model, the segments come from the href, and the labels are keyed by
 * the same href. That matters because `resolveMainBreadcrumb` rebuilds a
 * cumulative path per segment - two independent spellings of `/settings/devices`
 * would silently stop matching, and the crumb would render as a raw segment.
 *
 * The strings are `core.auth.settings`, the same namespace the panels and the
 * navigation read, so a host has one set to warm rather than a second one for
 * the crumb.
 *
 * The link is handed in for the same reason `SettingsNavContent` takes one:
 * Next.js renders this into the `@breadcrumb` parallel slot with `next-intl`'s
 * locale-aware `Link`, and a TanStack Start host renders it into the shell's
 * breadcrumb area through `staticData.breadcrumb` with the router's own.
 */
export const SettingsBreadcrumbContent = ({
  LinkComponent,
  navKey,
}: SettingsBreadcrumbContentProps) => {
  const t = useTranslations("core.auth.settings");
  const tNav = useTranslations("core.auth.settings.nav");

  const href = navKey ? settingsNavHref(navKey) : SETTINGS_ROOT_HREF;

  return (
    <BreadcrumbMainContent
      labels={{
        [SETTINGS_ROOT_HREF]: t("title"),
        ...(navKey ? { [href]: tNav(navKey) } : {}),
      }}
      LinkComponent={LinkComponent}
      // Derived from the href for the same reason the labels are keyed by it:
      // `resolveMainBreadcrumb` rebuilds a cumulative path per segment, and two
      // independent spellings of the same route would silently stop matching.
      segments={href.split("/").filter(Boolean)}
    />
  );
};
