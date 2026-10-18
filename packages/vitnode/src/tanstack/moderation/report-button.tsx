import { Link, useRouterState } from "@tanstack/react-router";
import { FlagIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

import { LOGIN_PATH, returnToFor } from "../auth/redirects";
import { useSessionQuery } from "../auth/session-query";
import { RouteMessages } from "../i18n/route-messages";

const ReportDialogContent = React.lazy(
  async () => await import("@/views/moderation/report/report-dialog-content"),
);

export const REPORT_NAMESPACES = ["core.global", "core.moderation"] as const;

export interface ReportButtonProps {
  className?: string;
  /** The locale the reported content was shown in, for moderators. */
  locale?: null | string;
  /** The plugin that registered the report target. */
  pluginId: string;
  /** The locale the visitor asked for, when the content fell back to another. */
  requestedLocale?: null | string;
  /** The reported item's id. */
  targetId: number | string;
  /** The report target type - for a content type with reports enabled, its id. */
  targetType: string;
  /** What the item is called, already translated, for the dialog title ("Report {type}"). */
  typeLabel: string;
}

const ReportButtonInner = ({
  className,
  locale = null,
  pluginId,
  requestedLocale = null,
  targetId,
  targetType,
  typeLabel,
}: ReportButtonProps) => {
  const t = useTranslations("core.moderation.report");
  const session = useSessionQuery();
  const [open, setOpen] = React.useState(false);
  const returnTo = useRouterState({
    select: state => returnToFor(state.location),
  });
  const signedIn = Boolean(session.data?.user);

  return (
    <>
      <Button
        className={className}
        onClick={() => {
          setOpen(true);
        }}
        size="sm"
        variant="ghost"
      >
        <FlagIcon aria-hidden />
        {t("button")}
      </Button>

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-balance">
              {t("title", { type: typeLabel })}
            </DialogTitle>
            <DialogDescription className="text-pretty">
              {signedIn ? t("desc") : t("signed_out")}
            </DialogDescription>
          </DialogHeader>

          {signedIn ? (
            <React.Suspense
              fallback={
                <div className="flex flex-col gap-3">
                  <Skeleton className="h-40 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              }
            >
              <ReportDialogContent
                locale={locale}
                onClose={() => {
                  setOpen(false);
                }}
                pluginId={pluginId}
                requestedLocale={requestedLocale}
                targetId={String(targetId)}
                targetType={targetType}
              />
            </React.Suspense>
          ) : (
            <div className="flex justify-end">
              <Link
                className={buttonVariants()}
                search={{ returnTo }}
                to={LOGIN_PATH}
              >
                {t("sign_in")}
              </Link>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

/**
 * A flag button that opens the "report this" dialog for one item. Guests are
 * offered a sign-in link instead of the form. Loads its own messages and the
 * dialog lazily, so it can go anywhere on a public page.
 *
 * The target must be registered on the API - a content type with `reports`
 * enabled, or a plugin's `moderation.reportTargets` - or the report is refused.
 *
 * @example
 * ```tsx
 * import { ReportButton } from "@vitnode/core/tanstack/moderation";
 *
 * <ReportButton
 *   pluginId={manifest.id}
 *   targetId={metadata.itemId}
 *   targetType={blogPostContentType.id}
 *   typeLabel={t("report_type")}
 * />;
 * ```
 */
export const ReportButton = (props: ReportButtonProps) => (
  <React.Suspense
    fallback={
      <Button disabled size="sm" variant="ghost">
        <FlagIcon aria-hidden />
      </Button>
    }
  >
    <RouteMessages namespaces={REPORT_NAMESPACES}>
      <ReportButtonInner {...props} />
    </RouteMessages>
  </React.Suspense>
);
