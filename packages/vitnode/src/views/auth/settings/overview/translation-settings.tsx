import { LanguagesIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Switch } from "@/components/ui/switch";

import { SETTINGS_ROW, SettingsGroup } from "../settings-group";

/** Saves the member's choice; resolves `false` when it was not saved. */
export type UpdateAutoTranslate = (auto: boolean) => Promise<boolean>;

/**
 * The member's "Automatically translate content" switch. Off shows every post
 * as written; the Translate button under each post still works.
 */
export const TranslationSettings = ({
  auto,
  onUpdate,
}: {
  auto: boolean;
  onUpdate: UpdateAutoTranslate;
}) => {
  const t = useTranslations("core.auth.settings.overview");
  const tErrors = useTranslations("core.global.errors");
  const [isSaving, setIsSaving] = React.useState(false);
  const labelId = React.useId();
  const descId = React.useId();

  return (
    <SettingsGroup title={t("translationTitle")}>
      <li className={SETTINGS_ROW}>
        <LanguagesIcon
          aria-hidden="true"
          className="text-muted-foreground size-4 shrink-0"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-foreground text-sm font-medium" id={labelId}>
            {t("autoTranslate")}
          </span>
          <span
            className="text-muted-foreground text-sm leading-relaxed text-pretty"
            id={descId}
          >
            {t("autoTranslateDesc")}
          </span>
        </div>
        <Switch
          aria-busy={isSaving}
          aria-describedby={descId}
          aria-labelledby={labelId}
          checked={auto}
          disabled={isSaving}
          onCheckedChange={async next => {
            setIsSaving(true);
            let saved = false;
            try {
              saved = await onUpdate(next);
            } catch {
              saved = false;
            } finally {
              setIsSaving(false);
            }

            if (!saved) {
              toast.error(tErrors("title"), {
                description: tErrors("internal_server_error"),
              });

              return;
            }

            toast.success(t(next ? "autoTranslateOn" : "autoTranslateOff"), {
              description: t(
                next ? "autoTranslateOnDesc" : "autoTranslateOffDesc",
              ),
            });
          }}
        />
      </li>
    </SettingsGroup>
  );
};
