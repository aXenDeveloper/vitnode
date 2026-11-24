import {
  KeyRoundIcon,
  LockIcon,
  LockKeyholeIcon,
  RotateCwIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SETTINGS_ROW,
  SettingsGroup,
} from "@/views/auth/settings/settings-group";

import type { PasscodeDialogMode } from "./passcode-dialog";

import { useChatE2E } from "./hooks";

const LazyPasscodeDialog = React.lazy(async () => ({
  default: (await import("./passcode-dialog")).PasscodeDialog,
}));

/** Settings -> Chat: the member's passcode and keys. */
export const ChatEncryptionSettings = ({ userId }: { userId: number }) => {
  const t = useTranslations("core.global.chat.e2e.settings");
  const e2e = useChatE2E(userId);
  const [dialog, setDialog] = React.useState<null | PasscodeDialogMode>(null);
  const isSet = e2e.status === "locked" || e2e.status === "unlocked";

  return (
    <SettingsGroup title={t("title")}>
      <li className={`${SETTINGS_ROW} items-start`}>
        {isSet ? (
          <ShieldCheckIcon
            aria-hidden="true"
            className="text-muted-foreground mt-0.5 size-4 shrink-0"
          />
        ) : (
          <ShieldAlertIcon
            aria-hidden="true"
            className="text-muted-foreground mt-0.5 size-4 shrink-0"
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">
              {e2e.status === "loading"
                ? t("loading")
                : isSet
                  ? e2e.status === "unlocked"
                    ? t("status_unlocked")
                    : t("status_locked")
                  : t("status_none")}
            </span>
            <span className="text-muted-foreground text-sm leading-relaxed text-pretty">
              {t("desc")}
              {e2e.required ? ` ${t("required")}` : null}
            </span>
          </div>
          {e2e.status === "loading" ? (
            <Skeleton className="h-8 w-40" />
          ) : isSet ? (
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  setDialog("change");
                }}
                size="sm"
                variant="outline"
              >
                <LockKeyholeIcon aria-hidden="true" />
                {t("change")}
              </Button>
              <Button
                onClick={() => {
                  setDialog("recovery_key");
                }}
                size="sm"
                variant="outline"
              >
                <KeyRoundIcon aria-hidden="true" />
                {t("new_recovery")}
              </Button>
              <Button
                onClick={() => {
                  setDialog("recover");
                }}
                size="sm"
                variant="outline"
              >
                <RotateCwIcon aria-hidden="true" />
                {t("forgot")}
              </Button>
              {e2e.status === "unlocked" ? (
                <Button
                  onClick={() =>
                    void e2e.lock().then(() => {
                      toast.success(t("locked"), {
                        description: t("locked_desc"),
                      });
                    })
                  }
                  size="sm"
                  variant="outline"
                >
                  <LockIcon aria-hidden="true" />
                  {t("lock")}
                </Button>
              ) : null}
              <Button
                onClick={() => {
                  setDialog("reset");
                }}
                size="sm"
                variant="ghost"
              >
                <ShieldAlertIcon aria-hidden="true" />
                {t("reset")}
              </Button>
            </div>
          ) : (
            <Button
              className="self-start"
              onClick={() => {
                setDialog("setup");
              }}
              size="sm"
            >
              <LockKeyholeIcon aria-hidden="true" />
              {t("setup")}
            </Button>
          )}
        </div>
      </li>
      {dialog ? (
        <React.Suspense fallback={null}>
          <LazyPasscodeDialog
            mode={dialog}
            onClose={() => {
              setDialog(null);
            }}
            userId={userId}
          />
        </React.Suspense>
      ) : null}
    </SettingsGroup>
  );
};
