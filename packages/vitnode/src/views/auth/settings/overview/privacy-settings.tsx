import { EyeOffIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { BrowseAnonymouslyPolicy } from "@/lib/user-presence";

import { Switch } from "@/components/ui/switch";
import { TooltipWithContent } from "@/components/ui/tooltip";

import type { UpdatePrivacy } from "./privacy-update";

import { SETTINGS_ROW, SettingsGroup } from "../settings-group";

const LOCKED_REASON = {
  disallowed: "browseAnonymouslyDisallowed",
  forced: "browseAnonymouslyForced",
} as const;

export const PrivacySettings = ({
  hideOnlineStatus,
  onUpdate,
  policy,
}: {
  /** The member's own choice; the roles' `policy` can override it. */
  hideOnlineStatus: boolean;
  onUpdate: UpdatePrivacy;
  policy: BrowseAnonymouslyPolicy;
}) => {
  const t = useTranslations("core.auth.settings.overview");
  const tErrors = useTranslations("core.global.errors");
  const [isSaving, setIsSaving] = React.useState(false);
  const labelId = React.useId();
  const descId = React.useId();
  const reasonId = React.useId();
  const lockedReason = policy === "allowed" ? null : t(LOCKED_REASON[policy]);
  const checked =
    policy === "forced" || (policy === "allowed" && hideOnlineStatus);

  const control = (
    <Switch
      aria-describedby={lockedReason ? `${descId} ${reasonId}` : descId}
      aria-labelledby={labelId}
      checked={checked}
      className={lockedReason ? "pointer-events-none" : undefined}
      disabled={isSaving || lockedReason !== null}
      onCheckedChange={async next => {
        setIsSaving(true);
        const result = await onUpdate({ hideOnlineStatus: next });
        setIsSaving(false);

        if (result.error) {
          toast.error(tErrors("title"), {
            description: tErrors("internal_server_error"),
          });

          return;
        }

        toast.success(
          t(next ? "browseAnonymouslyOn" : "browseAnonymouslyOff"),
          {
            description: t(
              next ? "browseAnonymouslyOnDesc" : "browseAnonymouslyOffDesc",
            ),
          },
        );
      }}
    />
  );

  return (
    <SettingsGroup title={t("privacyTitle")}>
      <li className={SETTINGS_ROW}>
        <EyeOffIcon
          aria-hidden="true"
          className="text-muted-foreground size-4 shrink-0"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-foreground text-sm font-medium" id={labelId}>
            {t("browseAnonymously")}
          </span>
          <span
            className="text-muted-foreground text-sm leading-relaxed text-pretty"
            id={descId}
          >
            {t("browseAnonymouslyDesc")}
          </span>
        </div>
        {lockedReason ? (
          <>
            <span className="sr-only" id={reasonId}>
              {lockedReason}
            </span>
            {/* A disabled switch gets no pointer or focus events, so the
                wrapper is what opens the tooltip. */}
            <TooltipWithContent text={lockedReason}>
              <span
                className="inline-flex cursor-not-allowed"
                data-slot="browse-anonymously-locked"
                // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                tabIndex={0}
              >
                {control}
              </span>
            </TooltipWithContent>
          </>
        ) : (
          control
        )}
      </li>
    </SettingsGroup>
  );
};
