import { EyeOffIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Switch } from "@/components/ui/switch";

import type { UpdatePrivacy } from "./privacy-update";

import { SETTINGS_ROW, SettingsGroup } from "../settings-group";

export const PrivacySettings = ({
  hideOnlineStatus,
  onUpdate,
}: {
  hideOnlineStatus: boolean;
  onUpdate: UpdatePrivacy;
}) => {
  const t = useTranslations("core.auth.settings.overview");
  const tErrors = useTranslations("core.global.errors");
  const [isSaving, setIsSaving] = React.useState(false);
  const labelId = React.useId();
  const descId = React.useId();

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
        <Switch
          aria-describedby={descId}
          aria-labelledby={labelId}
          checked={hideOnlineStatus}
          disabled={isSaving}
          onCheckedChange={async checked => {
            setIsSaving(true);
            const result = await onUpdate({ hideOnlineStatus: checked });
            setIsSaving(false);

            if (result.error) {
              toast.error(tErrors("title"), {
                description: tErrors("internal_server_error"),
              });

              return;
            }

            toast.success(
              t(checked ? "browseAnonymouslyOn" : "browseAnonymouslyOff"),
              {
                description: t(
                  checked
                    ? "browseAnonymouslyOnDesc"
                    : "browseAnonymouslyOffDesc",
                ),
              },
            );
          }}
        />
      </li>
    </SettingsGroup>
  );
};
