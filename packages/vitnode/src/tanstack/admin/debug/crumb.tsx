import { useTranslations } from "use-intl";

import type { DebugTab } from "./route-search";

import { RouteMessages } from "../../i18n/route-messages";

const DEBUG_CRUMB_NAMESPACES = ["admin.debug"] as const;

const DebugTabLabel = ({ tab }: { tab: Exclude<DebugTab, "overview"> }) => {
  const t = useTranslations("admin.debug.nav");

  return <>{t(tab)}</>;
};

export const debugTabCrumb = (tab: DebugTab) =>
  function DebugTabCrumb() {
    if (tab === "overview") return null;

    return (
      <RouteMessages namespaces={DEBUG_CRUMB_NAMESPACES}>
        <DebugTabLabel tab={tab} />
      </RouteMessages>
    );
  };
