import { useQuery } from "@tanstack/react-query";
import { useLocation, useRouter } from "@tanstack/react-router";
import React from "react";
import { useLocale } from "use-intl";

import { useLogo } from "@/components/logo-context";
import { SiteOfflineContent } from "@/views/site-offline/site-offline-content";
import { getVitNodeConfig } from "@/vitnode.config";

import { useSessionQuery } from "../auth/session-query";
import { RouteMessages } from "../i18n/route-messages";
import { isSiteClosedTo, isSiteOfflineBypass } from "./access";
import { SITE_OFFLINE_NAMESPACES } from "./load";
import { siteStatusQueryOptions } from "./query";
import { SiteOfflineStaffChip } from "./staff-chip";

/** The site status for the signed-in viewer (or a guest). */
const useViewerSiteStatus = () => {
  const { data: session } = useSessionQuery();

  return useQuery(
    siteStatusQueryOptions({ viewerId: session?.user?.id ?? null }),
  );
};

const OfflineScreen = () => {
  const locale = useLocale();
  const logo = useLogo();
  const { data, dataUpdatedAt } = useViewerSiteStatus();
  if (!data) return null;

  return (
    <main className="bg-muted/40 text-foreground flex min-h-dvh items-center justify-center px-4 py-12">
      <SiteOfflineContent
        className="motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-98 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300"
        defaultLanguage={getVitNodeConfig().i18n.defaultLocale}
        fetchedAt={dataUpdatedAt}
        language={locale}
        logo={logo}
        status={data}
      />
    </main>
  );
};

const StaffChip = () => {
  const { data } = useViewerSiteStatus();
  if (!data) return null;

  return <SiteOfflineStaffChip status={data} />;
};

/** The full-page offline screen, for a visitor who may not use the offline site. */
export const SiteOfflineScreen = () => (
  <RouteMessages namespaces={SITE_OFFLINE_NAMESPACES}>
    <OfflineScreen />
  </RouteMessages>
);

/**
 * Tells a viewer who may use the offline site that visitors see the offline
 * page: a floating pill with the details and an AdminCP link, and an
 * "(Offline)" prefix on the page title.
 */
export const SiteOfflineStaffBanner = () => (
  <RouteMessages namespaces={SITE_OFFLINE_NAMESPACES}>
    <StaffChip />
  </RouteMessages>
);

/** Which frame this visitor gets: the site, the site with the staff reminder, or the offline page. */
export type SiteOfflineView = "closed" | "open" | "staff";

/**
 * Which frame this visitor gets, from the viewer's status and the session that
 * `loadMainShell` already loaded.
 */
export const useSiteOfflineView = (): SiteOfflineView => {
  const { data: status } = useViewerSiteStatus();
  const { pathname } = useLocation();

  const router = useRouter();
  const wasClosed = React.useRef(false);

  let view: SiteOfflineView = "open";
  if (status?.offline) {
    if (isSiteClosedTo({ pathname, status })) view = "closed";
    else if (isSiteOfflineBypass(status)) view = "staff";
  }

  React.useEffect(() => {
    if (view === "closed") {
      wasClosed.current = true;

      return;
    }
    if (!wasClosed.current) return;
    wasClosed.current = false;
    void router.invalidate();
  }, [router, view]);

  return view;
};

/**
 * Swaps `children` for the offline page while the site is offline, except for
 * viewers who may use the offline site (they get a floating reminder pill)
 * and the sign-in pages. For a
 * custom public layout; `ThemeLayoutContent` already does it.
 */
export const SiteOfflineGate = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const view = useSiteOfflineView();

  if (view === "closed") return <SiteOfflineScreen />;

  return (
    <>
      {view === "staff" ? <SiteOfflineStaffBanner /> : null}
      {children}
    </>
  );
};
