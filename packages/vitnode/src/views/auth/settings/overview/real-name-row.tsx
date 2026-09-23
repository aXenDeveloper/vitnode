import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Switch } from "@/components/ui/switch";

import type { UpdatePersonalInformation } from "./personal-update";

import { SETTINGS_ROW } from "../settings-group";

export const RealNameRow = ({
  canEdit,
  checked,
  onUpdate,
}: {
  canEdit: boolean;
  checked: boolean;
  onUpdate: UpdatePersonalInformation;
}) => {
  const t = useTranslations("core.auth.settings.overview");
  const tError = useTranslations("core.global.errors");
  const [pending, setPending] = React.useState<boolean | null>(null);
  const id = React.useId();

  const onCheckedChange = async (next: boolean) => {
    setPending(next);
    const result = await onUpdate({ showRealName: next });
    setPending(null);

    if (result.error) {
      toast.error(tError("title"), {
        description: tError("internal_server_error"),
      });

      return;
    }

    toast.success(t("saved"), { description: t("savedDesc") });
  };

  return (
    <li className={SETTINGS_ROW}>
      <label
        className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5"
        htmlFor={id}
      >
        <span className="text-foreground text-sm font-medium">
          {t("showRealName")}
        </span>
        <span className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {t("showRealNameDesc")}
        </span>
      </label>
      <Switch
        checked={pending ?? checked}
        disabled={!canEdit || pending !== null}
        id={id}
        onCheckedChange={next => {
          void onCheckedChange(next);
        }}
      />
    </li>
  );
};
