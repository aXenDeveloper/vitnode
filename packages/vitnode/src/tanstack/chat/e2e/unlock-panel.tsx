import { LockKeyholeIcon, LockOpenIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";

import { AutoForm, setFormFieldError } from "@/components/form/auto-form";
import { AutoFormCheckbox } from "@/components/form/fields/checkbox";
import { AutoFormInput } from "@/components/form/fields/input";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

import type { PasscodeDialogMode } from "./passcode-dialog";

import { useChatE2E, WrongSecretError } from "./hooks";

const LazyPasscodeDialog = React.lazy(async () => ({
  default: (await import("./passcode-dialog")).PasscodeDialog,
}));

/**
 * Shown where encrypted messages would be: unlock with the passcode, or set
 * one up first. Plain chats never need it.
 */
export const ChatUnlockPanel = ({ userId }: { userId: number }) => {
  const t = useTranslations("core.global.chat.e2e.unlock");
  const e2e = useChatE2E(userId);
  const [dialog, setDialog] = React.useState<null | PasscodeDialogMode>(null);
  const formSchema = z.object({
    passcode: z.string().min(1),
    remember: z.boolean().default(true),
  });
  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async (
    values,
    form,
  ) => {
    try {
      await e2e.unlock(values.passcode, values.remember);
    } catch (error) {
      if (!(error instanceof WrongSecretError)) throw error;
      setFormFieldError(form, "passcode", t("wrong"));
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-4">
      <Empty className="w-full max-w-sm">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LockKeyholeIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>
            {e2e.status === "none" ? t("setup_title") : t("title")}
          </EmptyTitle>
          <EmptyDescription>
            {e2e.status === "none" ? t("setup_desc") : t("desc")}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="w-full">
          {e2e.status === "none" ? (
            <Button
              onClick={() => {
                setDialog("setup");
              }}
            >
              <LockKeyholeIcon aria-hidden="true" />
              {t("setup")}
            </Button>
          ) : e2e.status === "locked" ? (
            <div className="flex w-full flex-col gap-3 text-start">
              <AutoForm
                fields={[
                  {
                    component: props => (
                      <AutoFormInput
                        {...props}
                        autoComplete="current-password"
                        label={t("passcode")}
                        type="password"
                      />
                    ),
                    id: "passcode",
                  },
                  {
                    component: props => (
                      <AutoFormCheckbox {...props} label={t("remember")} />
                    ),
                    id: "remember",
                  },
                ]}
                formSchema={formSchema}
                onSubmit={onSubmit}
                submitButtonProps={{
                  children: (
                    <>
                      <LockOpenIcon aria-hidden="true" />
                      {t("submit")}
                    </>
                  ),
                }}
              />
              <Button
                className="self-center"
                onClick={() => {
                  setDialog("recover");
                }}
                size="sm"
                variant="link"
              >
                {t("forgot")}
              </Button>
            </div>
          ) : null}
        </EmptyContent>
      </Empty>
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
    </div>
  );
};
