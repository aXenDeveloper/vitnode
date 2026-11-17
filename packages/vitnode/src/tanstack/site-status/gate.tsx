import { useQuery } from "@tanstack/react-query";
import { useLocation, useRouter } from "@tanstack/react-router";
import { LogInIcon } from "lucide-react";
import React from "react";
import { useLocale, useTranslations } from "use-intl";

import { useLogo } from "@/components/logo-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SiteOfflineContent } from "@/views/site-offline/site-offline-content";
import { getVitNodeConfig } from "@/vitnode.config";

import { useSessionQuery } from "../auth/session-query";
import { RouteMessages } from "../i18n/route-messages";
import { HrefLink } from "../link";
import { isSiteClosedTo, isSiteOfflineBypass } from "./access";
import { SITE_OFFLINE_NAMESPACES } from "./load";
import { siteStatusQueryOptions } from "./query";

const OfflineScreen = () => {
  const t = useTranslations("core.site_offline");
  const locale = useLocale();
  const logo = useLogo();
  const { data, dataUpdatedAt } = useQuery(siteStatusQueryOptions());
  if (!data) return null;

  return (
    <main className="bg-background text-foreground flex min-h-dvh flex-col items-center justify-center">
      <SiteOfflineContent
        defaultLanguage={getVitNodeConfig().i18n.defaultLocale}
        fetchedAt={dataUpdatedAt}
        footer={
          <HrefLink
            className="text-muted-foreground inline-flex items-center gap-2 text-sm underline-offset-4 hover:underline"
            href="/login"
          >
            <LogInIcon aria-hidden="true" className="size-4" />
            {t("staff_sign_in")}
          </HrefLink>
        }
        language={locale}
        logo={logo}
        status={data}
      />
    </main>
  );
};

const StaffBanner = () => {
  const t = useTranslations("core.site_offline.staff_banner");

  return (
    <div className="container mx-auto px-4 pt-4">
      <Alert variant="warning">
        <AlertTitle>{t("title")}</AlertTitle>
        <AlertDescription className="leading-relaxed text-pretty">
          {t.rich("desc", {
            link: chunks => (
              <HrefLink
                className="font-medium underline underline-offset-4"
                href="/admin/core/system/site-status"
              >
                {chunks}
              </HrefLink>
            ),
          })}
        </AlertDescription>
      </Alert>
    </div>
  );
};

/** The full-page offline screen, for a visitor who is not staff. */
export const SiteOfflineScreen = () => (
  <RouteMessages namespaces={SITE_OFFLINE_NAMESPACES}>
    <OfflineScreen />
  </RouteMessages>
);

/** Tells staff that visitors see the offline page, with a link to the AdminCP. */
export const SiteOfflineStaffBanner = () => (
  <RouteMessages namespaces={SITE_OFFLINE_NAMESPACES}>
    <StaffBanner />
  </RouteMessages>
);

/** Which frame this visitor gets: the site, the site with the staff banner, or the offline page. */
export type SiteOfflineView = "closed" | "open" | "staff";

/**
 * Which frame this visitor gets, from the status and the session that
 * `loadMainShell` already loaded.
 */
export const useSiteOfflineView = (): SiteOfflineView => {
  const { data: status } = useQuery(siteStatusQueryOptions());
  const { data: session } = useSessionQuery();
  const { pathname } = useLocation();

  const router = useRouter();
  const wasClosed = React.useRef(false);

  let view: SiteOfflineView = "open";
  if (status?.offline) {
    if (isSiteClosedTo({ pathname, session, status })) view = "closed";
    else if (isSiteOfflineBypass(session)) view = "staff";
  }

  // The page behind the offline screen never loaded its data, so it is
  // loaded again the moment the site opens (or the visitor signs in as staff).
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
 * staff (who get a reminder banner above it) and the sign-in pages. For a
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
