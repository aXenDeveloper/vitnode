import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormInput } from "@/components/form/fields/input";
import { useDialog } from "@/components/ui/dialog";
import { PASSKEY_NAME_MAX_LENGTH } from "@/lib/passkey";

import type { AdminUserPasskey } from "./user-account-query";
import type { AdminUserDetail } from "./user-query";

import { useFailureToast } from "./use-failure-toast";
import {
  renameAdminUserPasskey,
  setAdminUserPassword,
} from "./user-account-mutations";

const PASSWORD_MIN_LENGTH = 8;

export const PasswordForm = ({
  onSaved,
  user,
}: {
  onSaved: () => Promise<void>;
  user: AdminUserDetail;
}) => {
  const t = useTranslations("admin.user.show.security");
  const { setIsDirty, setOpen } = useDialog();
  const showFailure = useFailureToast();
  const formSchema = z
    .object({
      password: z
        .string()
        .min(
          PASSWORD_MIN_LENGTH,
          t("passwordMin", { min: PASSWORD_MIN_LENGTH }),
        )
        .default(""),
      confirm: z.string().default(""),
    })
    .refine(values => values.password === values.confirm, {
      message: t("passwordMismatch"),
      path: ["confirm"],
    });

  return (
    <AutoForm
      fields={[
        {
          id: "password",
          component: props => (
            <AutoFormInput
              {...props}
              autoComplete="new-password"
              label={t("newPassword")}
              type="password"
            />
          ),
        },
        {
          id: "confirm",
          component: props => (
            <AutoFormInput
              {...props}
              autoComplete="new-password"
              label={t("confirmPassword")}
              type="password"
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={async values => {
        const result = await setAdminUserPassword(user.id, values.password);
        if ("error" in result) {
          showFailure();

          return;
        }
        await onSaved();
        setIsDirty?.(false);
        setOpen?.(false);
        toast.success(t("passwordSaved"), {
          description: t("passwordSavedDesc", { name: user.name }),
        });
      }}
      submitButtonProps={{ children: t("passwordSubmit") }}
    />
  );
};

export const RenamePasskeyForm = ({
  onSaved,
  passkey,
  user,
}: {
  onSaved: () => Promise<void>;
  passkey: AdminUserPasskey;
  user: AdminUserDetail;
}) => {
  const t = useTranslations("admin.user.show.security");
  const { setIsDirty, setOpen } = useDialog();
  const showFailure = useFailureToast();
  const formSchema = z.object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(PASSKEY_NAME_MAX_LENGTH)
      .default(passkey.name),
  });

  return (
    <AutoForm
      fields={[
        {
          id: "name",
          component: props => (
            <AutoFormInput
              {...props}
              autoComplete="off"
              label={t("passkeyName")}
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={async values => {
        const result = await renameAdminUserPasskey(
          user.id,
          passkey.id,
          values.name,
        );
        if ("error" in result) {
          showFailure();

          return;
        }
        await onSaved();
        setIsDirty?.(false);
        setOpen?.(false);
        toast.success(t("passkeyRenamed"));
      }}
      submitButtonProps={{ children: t("passkeyRenameSubmit") }}
    />
  );
};
