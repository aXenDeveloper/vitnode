import { TriangleAlertIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { ContentTarget } from "@/content/target";
import type { IssuedWarning } from "@/views/moderation/warnings/warnings-api";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

import { RouteMessages } from "../i18n/route-messages";
import { REPORT_NAMESPACES } from "./report-button";

const WarnDialogContent = React.lazy(
  async () => await import("@/views/moderation/warnings/warn-dialog-content"),
);

export interface WarnDialogProps {
  /**
   * The content the warning is for. The server resolves its authors and
   * moderation scope itself and refuses the warning unless `userId` is one of
   * the authors and the moderator has `can_warn` there. Leave it out for a
   * direct warning, which needs the core `warnings` `can_warn` permission.
   */
  content?: ContentTarget | null;
  /** Called with the server's result once the warning is issued. */
  onIssued?: (result: IssuedWarning) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  /** The report the warning answers, for the ModCP report screen. */
  reportId?: null | number;
  /** The member to warn. */
  userId: number;
}

const WarnDialogInner = ({ onOpenChange, open, ...props }: WarnDialogProps) => (
  <Dialog onOpenChange={onOpenChange} open={open}>
    <DialogContent className="flex flex-col gap-0 p-0 sm:max-w-lg">
      {open ? (
        <React.Suspense
          fallback={
            <div aria-busy="true" className="flex flex-col gap-5 p-6">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          }
        >
          <WarnDialogContent
            {...props}
            onClose={() => {
              onOpenChange(false);
            }}
          />
        </React.Suspense>
      ) : null}
    </DialogContent>
  </Dialog>
);

/**
 * The warn dialog on its own, for a menu item or any trigger you already
 * have. Shows the reason, points, expiry, the member's message, a staff note
 * and a live preview of the consequences; the form loads lazily.
 *
 * @example
 * ```tsx
 * import { WarnDialog } from "@vitnode/core/tanstack/moderation";
 *
 * <WarnDialog
 *   content={target}
 *   onOpenChange={setOpen}
 *   open={open}
 *   userId={comment.author.id}
 * />;
 * ```
 */
export const WarnDialog = (props: WarnDialogProps) => (
  <RouteMessages namespaces={REPORT_NAMESPACES}>
    <WarnDialogInner {...props} />
  </RouteMessages>
);

export interface WarnAuthorButtonProps extends Omit<
  WarnDialogProps,
  "onOpenChange" | "open"
> {
  className?: string;
  /** The id of the element naming the author, read after the button's label. */
  describedBy?: string;
}

/**
 * A **Warn author** button that opens {@link WarnDialog}. Render it only when
 * the server allowed it - for a content type, when the permissions route
 * answers `canWarn` - and the API checks everything again anyway.
 *
 * @example
 * ```tsx
 * import { contentTarget } from "@vitnode/core/content";
 * import { WarnAuthorButton } from "@vitnode/core/tanstack/moderation";
 *
 * {permissions.canWarn ? (
 *   <WarnAuthorButton
 *     content={contentTarget(manifest.id, topicContentType, topic.id)}
 *     userId={topic.author.id}
 *   />
 * ) : null}
 * ```
 */
export const WarnAuthorButton = ({
  className,
  describedBy,
  ...props
}: WarnAuthorButtonProps) => {
  const [open, setOpen] = React.useState(false);

  return (
    <RouteMessages namespaces={REPORT_NAMESPACES}>
      <WarnAuthorButtonLabel
        className={className}
        describedBy={describedBy}
        onClick={() => {
          setOpen(true);
        }}
      />
      <WarnDialogInner {...props} onOpenChange={setOpen} open={open} />
    </RouteMessages>
  );
};

const WarnAuthorButtonLabel = ({
  className,
  describedBy,
  onClick,
}: {
  className?: string;
  describedBy?: string;
  onClick: () => void;
}) => {
  const t = useTranslations("core.moderation.warn");

  return (
    <Button
      aria-describedby={describedBy}
      className={className}
      onClick={onClick}
      variant="outline"
    >
      <TriangleAlertIcon aria-hidden="true" />
      {t("button")}
    </Button>
  );
};
