import { Link, useRouterState } from "@tanstack/react-router";
import { FlagIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { ContentTarget } from "@/content/target";

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

/** The message namespaces the report button and dialog render with. */
export const REPORT_NAMESPACES = ["core.global", "core.moderation"] as const;

interface ReportTargetProps {
  /** The locale the reported content was shown in, for moderators. */
  locale?: null | string;
  /** The locale the visitor asked for, when the content fell back to another. */
  requestedLocale?: null | string;
  /**
   * The reported record. For a content type with `reports` enabled, build it
   * with `contentTarget` from `@vitnode/core/content`.
   */
  target: ContentTarget;
  /** What the item is called, already translated, for "Report {type}". */
  typeLabel: string;
}

export interface ReportDialogProps extends ReportTargetProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export interface ReportButtonProps extends ReportTargetProps {
  className?: string;
  /**
   * The id of the element that names the item, such as its title or its
   * author. Screen readers read it after the button's label, so a list of
   * report buttons is told apart.
   */
  describedBy?: string;
}

const ReportDialogInner = ({
  locale = null,
  onOpenChange,
  open,
  requestedLocale = null,
  target,
  typeLabel,
}: ReportDialogProps) => {
  const t = useTranslations("core.moderation.report");
  const session = useSessionQuery();
  const returnTo = useRouterState({
    select: state => returnToFor(state.location),
  });
  const signedIn = Boolean(session.data?.user);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
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
                onOpenChange(false);
              }}
              pluginId={target.pluginId}
              requestedLocale={requestedLocale}
              targetId={target.id}
              targetType={target.type}
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
  );
};

const ReportButtonInner = ({
  className,
  describedBy,
  ...dialog
}: ReportButtonProps) => {
  const t = useTranslations("core.moderation.report");
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button
        aria-describedby={describedBy}
        aria-haspopup="dialog"
        aria-label={t("title", { type: dialog.typeLabel })}
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

      <ReportDialogInner {...dialog} onOpenChange={setOpen} open={open} />
    </>
  );
};

/**
 * The "report this" dialog on its own, controlled by you. Use it when the
 * trigger is yours - a menu item, a keyboard shortcut - or to share one dialog
 * across a long list instead of mounting one per row. Guests are offered a
 * sign-in link instead of the form, and the form loads only once the dialog
 * opens.
 *
 * @example
 * ```tsx
 * import type { ContentTarget } from "@vitnode/core/content";
 *
 * import { ReportDialog } from "@vitnode/core/tanstack/moderation";
 *
 * const [reporting, setReporting] = useState<ContentTarget | null>(null);
 *
 * {reporting ? (
 *   <ReportDialog
 *     onOpenChange={open => {
 *       if (!open) setReporting(null);
 *     }}
 *     open
 *     target={reporting}
 *     typeLabel={t("report_type")}
 *   />
 * ) : null}
 * ```
 */
export const ReportDialog = (props: ReportDialogProps) => (
  <React.Suspense fallback={null}>
    <RouteMessages namespaces={REPORT_NAMESPACES}>
      <ReportDialogInner {...props} />
    </RouteMessages>
  </React.Suspense>
);

/**
 * A flag button that opens the "report this" dialog for one item. Guests are
 * offered a sign-in link instead of the form. Loads its own messages and the
 * dialog lazily, so it can go anywhere on a public page.
 *
 * The target must be registered on the API - a content type with `reports`
 * enabled, or a plugin's `moderation.reportTargets` - or the report is refused.
 * The server re-checks everything: the reporter must be signed in and able to
 * read the target.
 *
 * @example
 * ```tsx
 * import { contentTarget } from "@vitnode/core/content";
 * import { ReportButton } from "@vitnode/core/tanstack/moderation";
 *
 * import { commentContentType } from "@/content/comment";
 * import { manifest } from "@/manifest.gen";
 *
 * <ReportButton
 *   describedBy={`comment-${comment.id}-author`}
 *   target={contentTarget(manifest.id, commentContentType, comment.id)}
 *   typeLabel={t("report_type")}
 * />;
 * ```
 */
export const ReportButton = (props: ReportButtonProps) => (
  <React.Suspense
    fallback={<Skeleton aria-hidden className="h-8 w-20 rounded-md" />}
  >
    <RouteMessages namespaces={REPORT_NAMESPACES}>
      <ReportButtonInner {...props} />
    </RouteMessages>
  </React.Suspense>
);
