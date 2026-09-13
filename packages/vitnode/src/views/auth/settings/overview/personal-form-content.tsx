import { PhoneIcon } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";
import type {
  PersonalInformationFields,
  UserPersonalInformation,
} from "@/lib/user-personal-information";

import { AutoForm, AutoFormSubmitButton } from "@/components/form/auto-form";
import { AutoFormInput } from "@/components/form/fields/input";
import { AutoFormSwitch } from "@/components/form/fields/switch";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter, useDialog } from "@/components/ui/dialog";
import { InputGroupAddon } from "@/components/ui/input-group";
import {
  USER_FIRST_NAME_MAX_LENGTH,
  USER_HEADLINE_MAX_LENGTH,
  USER_LAST_NAME_MAX_LENGTH,
  USER_PHONE_MAX_LENGTH,
  USER_PHONE_PATTERN,
} from "@/lib/user-personal-information";

import type { UpdatePersonalInformation } from "./personal-update";

export const PersonalFormContent = ({
  fields,
  onUpdate,
  user,
}: {
  fields: PersonalInformationFields;
  onUpdate: UpdatePersonalInformation;
  user: UserPersonalInformation;
}) => {
  const t = useTranslations("core.auth.settings.overview");
  const tGlobal = useTranslations("core.global");
  const tError = useTranslations("core.global.errors");
  const { setIsDirty, setOpen } = useDialog();

  const formSchema = z.object({
    firstName: z
      .string()
      .max(USER_FIRST_NAME_MAX_LENGTH)
      .default(user.firstName ?? ""),
    lastName: z
      .string()
      .max(USER_LAST_NAME_MAX_LENGTH)
      .default(user.lastName ?? ""),
    phone: z
      .string()
      .max(USER_PHONE_MAX_LENGTH)
      .refine(value => value === "" || USER_PHONE_PATTERN.test(value), {
        message: tError("field_invalid_phone"),
      })
      .default(user.phone ?? ""),
    headline: z
      .string()
      .max(USER_HEADLINE_MAX_LENGTH)
      .default(user.headline ?? ""),
    showRealName: z.boolean().default(user.showRealName),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const result = await onUpdate(values);

    if (result.error) {
      toast.error(tError("title"), {
        description: tError("internal_server_error"),
      });

      return;
    }

    setIsDirty?.(false);
    setOpen?.(false);
    toast.success(t("saved"), { description: t("savedDesc") });
  };

  return (
    <AutoForm
      fields={[
        {
          component: props => (
            <AutoFormInput
              {...props}
              autoComplete="given-name"
              label={t("firstName")}
            />
          ),
          hidden: () => !fields.firstName,
          id: "firstName",
        },
        {
          component: props => (
            <AutoFormInput
              {...props}
              autoComplete="family-name"
              label={t("lastName")}
            />
          ),
          hidden: () => !fields.lastName,
          id: "lastName",
        },
        {
          component: props => (
            <AutoFormInput
              {...props}
              autoComplete="tel"
              inputMode="tel"
              label={t("phone")}
              placeholder="+48 600 700 800"
              type="tel"
            >
              <InputGroupAddon>
                <PhoneIcon />
              </InputGroupAddon>
            </AutoFormInput>
          ),
          hidden: () => !fields.phone,
          id: "phone",
        },
        {
          component: props => (
            <AutoFormInput
              {...props}
              description={t("headlineDesc", { max: USER_HEADLINE_MAX_LENGTH })}
              label={t("headline")}
            />
          ),
          hidden: () => !fields.headline,
          id: "headline",
        },
        {
          component: props => (
            <AutoFormSwitch
              {...props}
              description={t("showRealNameDesc")}
              label={t("showRealName")}
            />
          ),
          hidden: () => !fields.showRealName,
          id: "showRealName",
        },
      ]}
      formSchema={formSchema}
      layout={rendered => (
        <>
          {fields.firstName || fields.lastName ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {rendered.firstName}
              {rendered.lastName}
            </div>
          ) : null}

          {rendered.phone}

          {rendered.headline}

          {rendered.showRealName}

          <DialogFooter>
            <DialogClose
              render={<Button variant="ghost">{tGlobal("cancel")}</Button>}
            />
            <AutoFormSubmitButton>{t("save")}</AutoFormSubmitButton>
          </DialogFooter>
        </>
      )}
      mode="all"
      onSubmit={onSubmit}
    />
  );
};
