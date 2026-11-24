import { CHAT_E2E } from "@vitnode/api/lib/chat/e2e";
import {
  CopyIcon,
  DownloadIcon,
  KeyRoundIcon,
  LockKeyholeIcon,
  ShieldCheckIcon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";

import { AutoForm, setFormFieldError } from "@/components/form/auto-form";
import { AutoFormCheckbox } from "@/components/form/fields/checkbox";
import { AutoFormInput } from "@/components/form/fields/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useChatE2E, WrongSecretError } from "./hooks";

/** What the dialog does. */
export type PasscodeDialogMode =
  | "change"
  | "recover"
  | "recovery_key"
  | "reset"
  | "setup";

const passcodeSchema = z
  .string()
  .min(CHAT_E2E.passcodeMinLength)
  .max(CHAT_E2E.passcodeMaxLength);

/** Shows a new recovery key once, with copy and download. */
const RecoveryKeyStep = ({
  onDone,
  recoveryKey,
}: {
  onDone: () => void;
  recoveryKey: string;
}) => {
  const t = useTranslations("core.global.chat.e2e.recovery");
  const [saved, setSaved] = React.useState(false);
  const savedId = React.useId();

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>{t("desc")}</DialogDescription>
      </DialogHeader>
      <p
        aria-label={t("label")}
        className="bg-muted rounded-lg p-4 text-center font-mono text-base font-semibold tracking-wider break-all select-all"
      >
        {recoveryKey}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            void navigator.clipboard.writeText(recoveryKey).then(() => {
              toast.success(t("copied"), { description: t("copied_desc") });
            });
          }}
          size="sm"
          variant="outline"
        >
          <CopyIcon aria-hidden="true" />
          {t("copy")}
        </Button>
        <Button
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([`${t("file_intro")}\n\n${recoveryKey}\n`], {
                type: "text/plain",
              }),
            );
            const link = document.createElement("a");
            link.href = url;
            link.download = "chat-recovery-key.txt";
            link.click();
            URL.revokeObjectURL(url);
          }}
          size="sm"
          variant="outline"
        >
          <DownloadIcon aria-hidden="true" />
          {t("download")}
        </Button>
      </div>
      <label className="flex items-start gap-2 text-sm" htmlFor={savedId}>
        <Checkbox
          checked={saved}
          id={savedId}
          onCheckedChange={value => {
            setSaved(value);
          }}
        />
        <span className="leading-relaxed">{t("saved")}</span>
      </label>
      <DialogFooter>
        <Button disabled={!saved} onClick={onDone}>
          <ShieldCheckIcon aria-hidden="true" />
          {t("done")}
        </Button>
      </DialogFooter>
    </>
  );
};

/**
 * Every passcode flow in one dialog: set up, change, recover with the
 * recovery key, get a new recovery key, or reset (losing encrypted history).
 */
export const PasscodeDialog = ({
  mode,
  onClose,
  userId,
}: {
  mode: PasscodeDialogMode;
  onClose: () => void;
  userId: number;
}) => {
  const t = useTranslations("core.global.chat.e2e.dialog");
  const tErrors = useTranslations("core.global.errors");
  const e2e = useChatE2E(userId);
  const [recoveryKey, setRecoveryKey] = React.useState<null | string>(null);

  const needsCurrent = mode === "change" || mode === "recovery_key";
  const needsRecovery = mode === "recover";
  const needsNew = mode !== "recovery_key";
  const formSchema = z.object({
    current: needsCurrent ? z.string().min(1) : z.string().default(""),
    recovery: needsRecovery ? z.string().min(10) : z.string().default(""),
    passcode: needsNew ? passcodeSchema : z.string().default(""),
    confirm: needsNew ? z.string().min(1) : z.string().default(""),
    remember: z.boolean().default(true),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async (
    values,
    form,
  ) => {
    if (needsNew && values.passcode !== values.confirm) {
      setFormFieldError(form, "confirm", t("mismatch"));

      return;
    }
    try {
      switch (mode) {
        case "change":
          await e2e.changePasscode(values.current, values.passcode);
          toast.success(t("changed"), { description: t("changed_desc") });
          onClose();
          break;
        case "recover":
          await e2e.recover(values.recovery, values.passcode, values.remember);
          toast.success(t("recovered"), { description: t("recovered_desc") });
          onClose();
          break;
        case "recovery_key":
          setRecoveryKey(await e2e.newRecoveryKey(values.current));
          break;
        case "reset":
          setRecoveryKey(await e2e.reset(values.passcode, values.remember));
          break;
        case "setup":
          setRecoveryKey(await e2e.setup(values.passcode, values.remember));
          break;
      }
    } catch (error) {
      if (error instanceof WrongSecretError) {
        setFormFieldError(
          form,
          needsRecovery ? "recovery" : "current",
          needsRecovery ? t("wrong_recovery") : t("wrong_passcode"),
        );

        return;
      }
      toast.error(tErrors("title"), {
        description: tErrors("internal_server_error"),
      });
    }
  };

  return (
    <Dialog
      onOpenChange={open => {
        if (!open && !recoveryKey) onClose();
      }}
      open
    >
      <DialogContent>
        {recoveryKey ? (
          <RecoveryKeyStep
            onDone={() => {
              const done =
                mode === "reset"
                  ? "reset"
                  : mode === "recovery_key"
                    ? "recovery_key"
                    : "setup";
              toast.success(t(`${done}_done`), {
                description: t(`${done}_done_desc`),
              });
              onClose();
            }}
            recoveryKey={recoveryKey}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {mode === "reset" ? (
                  <KeyRoundIcon aria-hidden="true" className="size-5" />
                ) : (
                  <LockKeyholeIcon aria-hidden="true" className="size-5" />
                )}
                {t(`${mode}_title`)}
              </DialogTitle>
              <DialogDescription>{t(`${mode}_desc`)}</DialogDescription>
            </DialogHeader>
            <AutoForm
              fields={[
                ...(needsCurrent
                  ? [
                      {
                        component: (
                          props: React.ComponentProps<typeof AutoFormInput>,
                        ) => (
                          <AutoFormInput
                            {...props}
                            autoComplete="current-password"
                            label={t("current")}
                            type="password"
                          />
                        ),
                        id: "current",
                      },
                    ]
                  : []),
                ...(needsRecovery
                  ? [
                      {
                        component: (
                          props: React.ComponentProps<typeof AutoFormInput>,
                        ) => (
                          <AutoFormInput
                            {...props}
                            autoComplete="off"
                            className="font-mono uppercase"
                            label={t("recovery")}
                            placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
                          />
                        ),
                        id: "recovery",
                      },
                    ]
                  : []),
                ...(needsNew
                  ? [
                      {
                        component: (
                          props: React.ComponentProps<typeof AutoFormInput>,
                        ) => (
                          <AutoFormInput
                            {...props}
                            autoComplete="new-password"
                            description={t("passcode_desc", {
                              min: CHAT_E2E.passcodeMinLength,
                            })}
                            label={t("passcode")}
                            type="password"
                          />
                        ),
                        id: "passcode",
                      },
                      {
                        component: (
                          props: React.ComponentProps<typeof AutoFormInput>,
                        ) => (
                          <AutoFormInput
                            {...props}
                            autoComplete="new-password"
                            label={t("confirm")}
                            type="password"
                          />
                        ),
                        id: "confirm",
                      },
                    ]
                  : []),
                ...(mode === "setup" || mode === "reset" || mode === "recover"
                  ? [
                      {
                        component: (
                          props: React.ComponentProps<typeof AutoFormCheckbox>,
                        ) => (
                          <AutoFormCheckbox
                            {...props}
                            description={t("remember_desc")}
                            label={t("remember")}
                          />
                        ),
                        id: "remember",
                      },
                    ]
                  : []),
              ]}
              formSchema={formSchema}
              onSubmit={onSubmit}
              submitButtonProps={{
                children: (
                  <>
                    <LockKeyholeIcon aria-hidden="true" />
                    {t(`${mode}_submit`)}
                  </>
                ),
                variant: mode === "reset" ? "destructive" : "default",
              }}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
