import { cn } from "cn";
import { RotateCcwIcon } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "use-intl";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

import { useContentLive } from "./context";

const SAVED_JUST_NOW_MS = 60_000;
const SAVED_TICK_MS = 15_000;

const SavedAt = ({ savedAt }: { savedAt: string }) => {
  const t = useTranslations("core.content.live.status");
  const format = useFormatter();
  const now = useNow({ updateInterval: SAVED_TICK_MS });
  const date = new Date(savedAt);
  const exact = format.dateTime(date, { timeStyle: "short" });
  const relative =
    now.getTime() - date.getTime() < SAVED_JUST_NOW_MS
      ? t("saved_just_now")
      : t("saved", { time: format.relativeTime(date, now) });

  return (
    <>
      <time
        aria-hidden
        dateTime={savedAt}
        suppressHydrationWarning
        title={exact}
      >
        {relative}
      </time>
      <span className="sr-only">{t("saved_at", { time: exact })}</span>
    </>
  );
};

const DIALOG_CLOSE_MS = 300;

const DiscardChanges = ({
  onDiscard,
}: {
  onDiscard: () => Promise<boolean>;
}) => {
  const t = useTranslations("core.content.live.status");

  return (
    <ConfirmActionAlertDialog
      description={t("discard_desc")}
      icon={<RotateCcwIcon />}
      onSubmit={({ onClose }) => {
        onClose();
        window.setTimeout(() => {
          void onDiscard();
        }, DIALOG_CLOSE_MS);
      }}
      textSubmit={t("discard_confirm")}
      title={t("discard_title")}
    >
      <Button
        aria-label={t("discard_label")}
        className="text-muted-foreground hover:text-foreground"
        size="xs"
        type="button"
        variant="ghost"
      >
        <RotateCcwIcon aria-hidden />
        <span className="max-sm:sr-only">{t("discard")}</span>
      </Button>
    </ConfirmActionAlertDialog>
  );
};

/**
 * "Saving…", "Draft saved 3 minutes ago", "Unsaved changes": what autosave did
 * with this person's typing, announced politely. Renders nothing outside a
 * live form, so a layout can place it unconditionally.
 */
export const ContentLiveStatus = ({ className }: { className?: string }) => {
  const t = useTranslations("core.content.live.status");
  const live = useContentLive();
  if (!live) return null;

  const { dirty, failed, savedAt, saving } = live.status;
  if (!dirty && !failed && !saving && !savedAt) return null;

  return (
    <div className={cn("flex min-w-0 items-center gap-1", className)}>
      <p
        className="text-muted-foreground flex min-w-0 items-center gap-2 text-sm leading-relaxed"
        role="status"
      >
        {saving ? (
          <span className="flex items-center gap-1.5">
            <Spinner className="size-3.5" />
            <span className="max-sm:sr-only">{t("saving")}</span>
          </span>
        ) : failed ? (
          <span className="text-destructive">{t("failed")}</span>
        ) : savedAt ? (
          <span className={dirty ? "sr-only" : "max-lg:sr-only"}>
            <SavedAt savedAt={savedAt} />
          </span>
        ) : null}
        {dirty ? (
          <span className="text-foreground flex items-center gap-1.5 font-medium">
            <span
              aria-hidden
              className="bg-warn size-2 shrink-0 rounded-full"
            />
            <span className="max-sm:sr-only">{t("unsaved")}</span>
          </span>
        ) : null}
      </p>
      {dirty && live.discard ? (
        <DiscardChanges onDiscard={live.discard} />
      ) : null}
    </div>
  );
};
