"use client";

import { LinkIcon, PencilIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormInput } from "@/components/form/fields/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  useDialog,
} from "@/components/ui/dialog";

import { mutationApi } from "./mutation-api.server";

export const EditNameCode = ({
  id,
  nameCode,
}: {
  id: number;
  nameCode: string;
}) => {
  const t = useTranslations("admin.user.show");

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            aria-label={t("editNameCode")}
            size="icon-xs"
            variant="ghost"
          />
        }
      >
        <PencilIcon />
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="size-5" />
            {t("editNameCode")}
          </DialogTitle>
          <DialogDescription>{t("editNameCodeDesc")}</DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>{t("editNameCodeWarningTitle")}</AlertTitle>
          <AlertDescription>{t("editNameCodeWarning")}</AlertDescription>
        </Alert>

        <FormEditNameCode id={id} nameCode={nameCode} />
      </DialogContent>
    </Dialog>
  );
};

// Rendered as a child of <Dialog> so `useDialog()` can close it on success.
const FormEditNameCode = ({
  id,
  nameCode,
}: {
  id: number;
  nameCode: string;
}) => {
  const t = useTranslations("admin.user.show");
  const tError = useTranslations("core.global.errors");
  const { setOpen, setIsDirty } = useDialog();

  const formSchema = z.object({
    newNameCode: z
      .string({ message: tError("field_required") })
      .min(3, tError("field_min_length", { min: 3 }))
      .max(255)
      .regex(/^[a-zA-Z0-9-]+$/, t("nameCodeInvalid"))
      .refine(value => value !== nameCode, t("nameCodeSame"))
      .default(""),
    currentNameCode: z
      .string({ message: tError("field_required") })
      .refine(value => value === nameCode, t("nameCodeConfirmMismatch"))
      .default(""),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async (
    values,
    form,
  ) => {
    const mutation = await mutationApi(id, {
      nameCode: values.newNameCode,
    });

    if ("data" in mutation) {
      setIsDirty?.(false);
      setOpen?.(false);
      toast.success(t("updateSuccess"));

      return;
    }

    if (mutation.error.status === 409) {
      form.setError(
        "newNameCode",
        { type: "manual", message: t("nameCodeExists") },
        { shouldFocus: true },
      );

      return;
    }

    toast.error(tError("title"), {
      description: tError("internal_server_error"),
    });
  };

  return (
    <AutoForm
      fields={[
        {
          id: "currentNameCode",
          component: props => (
            <AutoFormInput
              autoComplete="off"
              label={t.rich("confirmNameCode", {
                bold: chunks => <span className="font-semibold">{chunks}</span>,
                nameCode: () => <code className="font-mono">{nameCode}</code>,
              })}
              {...props}
            />
          ),
        },
        {
          id: "newNameCode",
          component: props => (
            <AutoFormInput label={t("newNameCode")} {...props} />
          ),
        },
      ]}
      formSchema={formSchema}
      mode="all"
      onSubmit={onSubmit}
      submitButtonProps={{
        children: t("saveNameCode"),
        variant: "destructive",
      }}
    />
  );
};
