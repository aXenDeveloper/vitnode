import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";

import { AutoForm, AutoFormSubmitButton } from "@/components/form/auto-form";
import { AutoFormInput } from "@/components/form/fields/input";
import { Button } from "@/components/ui/button";
import { PASSKEY_NAME_MAX_LENGTH } from "@/lib/passkey";

import type { RenamePasskey } from "./passkeys-mutations";

export const PasskeyNameEditor = ({
  id,
  name,
  onClose,
  onRename,
}: {
  id: number;
  name: string;
  onClose: () => void;
  onRename: RenamePasskey;
}) => {
  const t = useTranslations("core.auth.settings.passkeys");
  const tGlobal = useTranslations("core.global");
  const tErrors = useTranslations("core.global.errors");
  const [autoFocus] = React.useState(
    () => !window.matchMedia("(pointer: coarse)").matches,
  );

  const formSchema = z.object({
    name: z.string().trim().min(1).max(PASSKEY_NAME_MAX_LENGTH).default(name),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const result = await onRename({ id, name: values.name });

    if (!result.ok) {
      if (result.failure === "not_found") {
        toast.error(t("errors.not_found.title"), {
          description: t("errors.not_found.desc"),
        });
        onClose();

        return;
      }

      toast.error(tErrors("title"), {
        description: tErrors("internal_server_error"),
      });

      return;
    }

    toast.success(t("rename.success"), {
      description: t("rename.success_desc", { name: values.name }),
    });
    onClose();
  };

  return (
    <AutoForm
      className="flex flex-col gap-3 px-4 py-4"
      fields={[
        {
          component: props => (
            <AutoFormInput
              {...props}
              autoComplete="off"
              autoFocus={autoFocus}
              label={t("rename.label")}
              maxLength={PASSKEY_NAME_MAX_LENGTH}
            />
          ),
          id: "name",
        },
      ]}
      formSchema={formSchema}
      layout={rendered => (
        <>
          {rendered.name}
          <div className="flex justify-end gap-2">
            <Button onClick={onClose} type="button" variant="ghost">
              {tGlobal("cancel")}
            </Button>
            <AutoFormSubmitButton>{t("rename.save")}</AutoFormSubmitButton>
          </div>
        </>
      )}
      mode="all"
      onKeyDown={event => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        onClose();
      }}
      onSubmit={onSubmit}
    />
  );
};
