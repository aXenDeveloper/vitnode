import { cn } from "cn";
import React from "react";
import { useTranslations } from "use-intl";

import type {
  AddPasskey,
  DeletePasskey,
  RenamePasskey,
} from "./passkeys-mutations";
import type { Passkey } from "./passkeys-query";

import { usePasskeySupport } from "../../passkeys/webauthn";
import { SETTINGS_ROW, SettingsGroup } from "../settings-group";
import { AddPasskeyButton } from "./add-passkey-button";
import { PasskeyItem } from "./passkey-item";

export const PasskeysContent = ({
  isPasswordEnabled,
  onAdd,
  onDelete,
  onRename,
  passkeys,
}: {
  isPasswordEnabled: boolean;
  onAdd: AddPasskey;
  onDelete: DeletePasskey;
  onRename: RenamePasskey;
  passkeys: Passkey[];
}) => {
  const t = useTranslations("core.auth.settings.passkeys");
  const isSupported = usePasskeySupport();
  const hintId = React.useId();

  const hint = isSupported ? null : t("unsupported_hint");

  return (
    <section
      aria-labelledby={`${hintId}-title`}
      className="flex flex-col gap-2"
    >
      <div className="flex flex-col gap-1 px-4">
        <h2
          className="text-foreground text-base font-semibold text-balance"
          id={`${hintId}-title`}
        >
          {t("title")}
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {t("desc")}
        </p>
      </div>

      <SettingsGroup
        footer={hint ? <span id={hintId}>{hint}</span> : undefined}
      >
        {passkeys.length === 0 ? (
          <li className={cn(SETTINGS_ROW, "text-muted-foreground text-sm")}>
            {t("empty")}
          </li>
        ) : (
          passkeys.map(passkey => (
            <PasskeyItem
              isPasswordEnabled={isPasswordEnabled}
              key={passkey.id}
              onDelete={onDelete}
              onRename={onRename}
              passkey={passkey}
            />
          ))
        )}

        <li className={SETTINGS_ROW}>
          <AddPasskeyButton
            describedBy={hint ? hintId : undefined}
            isSupported={isSupported}
            onAdd={onAdd}
          />
        </li>
      </SettingsGroup>
    </section>
  );
};
