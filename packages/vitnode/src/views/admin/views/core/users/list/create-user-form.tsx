"use client";

import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormInput } from "@/components/form/fields/input";
import { useDialog } from "@/components/ui/dialog";

import type { CreateAdminUser } from "./create-user-content";

import { adminUserCreateConflictField } from "../users-mutations";

export const CreateUserForm = ({ onCreate }: { onCreate: CreateAdminUser }) => {
  const t = useTranslations("admin.user.create");
  const tError = useTranslations("core.global.errors");
  const { setIsDirty, setOpen } = useDialog();

  const formSchema = z.object({
    email: z.email({ message: t("email.invalid") }).default(""),
    name: z
      .string({ message: tError("field_required") })
      .min(3, t("name.min_length"))
      .max(32, t("name.max_length"))
      .default(""),
    password: z
      .string({ message: tError("field_required") })
      .min(8, t("password.invalid"))
      .default(""),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async (
    values,
    form,
  ) => {
    const result = await onCreate(values);

    if ("data" in result) {
      setIsDirty?.(false);
      setOpen?.(false);
      toast.success(t("success", { name: result.data.name }));

      return;
    }

    // `409` is the only refusal with a cause worth naming, and the API says
    // which of the two columns collided in the body rather than in a code.
    const field =
      result.error.status === 409
        ? adminUserCreateConflictField(result.error.message ?? "")
        : null;

    if (field) {
      form.setError(
        field,
        { message: t(`${field}.exists`), type: "manual" },
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
          component: props => (
            <AutoFormInput label={t("name.label")} {...props} />
          ),
          id: "name",
        },
        {
          component: props => (
            <AutoFormInput label={t("email.label")} {...props} />
          ),
          id: "email",
        },
        {
          component: props => (
            <AutoFormInput
              label={t("password.label")}
              type="password"
              {...props}
            />
          ),
          id: "password",
        },
      ]}
      formSchema={formSchema}
      mode="all"
      onSubmit={onSubmit}
      submitButtonProps={{ children: t("submit") }}
    />
  );
};
