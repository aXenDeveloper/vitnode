import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormCombobox } from "@/components/form/fields/combobox";
import { AutoFormInput } from "@/components/form/fields/input";
import { AutoFormSelect } from "@/components/form/fields/select";
import { AutoFormSwitch } from "@/components/form/fields/switch";
import { useLanguages } from "@/components/languages-provider";
import { useDialog } from "@/components/ui/dialog";
import {
  USER_FIRST_NAME_MAX_LENGTH,
  USER_HEADLINE_MAX_LENGTH,
  USER_LAST_NAME_MAX_LENGTH,
  USER_PHONE_MAX_LENGTH,
  USER_PHONE_PATTERN,
} from "@/lib/user-personal-information";
import {
  supportedTimeZones,
  timeZoneLabel,
} from "@/views/auth/settings/overview/time-zone-update";

import type { UpdateAdminUser } from "./user-fields-content";
import type { AdminUserDetail } from "./user-query";

import { useFailureToast } from "./use-failure-toast";

const AUTOMATIC_TIME_ZONE = "auto";

const toDateInput = (value: AdminUserDetail["birthday"]): string => {
  if (!value) return "";
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

const emptyToNull = (value: string): null | string => {
  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
};

export const PersonalForm = ({
  onUpdate,
  user,
}: {
  onUpdate: UpdateAdminUser;
  user: AdminUserDetail;
}) => {
  const t = useTranslations("admin.user.show.personal");
  const tError = useTranslations("core.global.errors");
  const { setIsDirty, setOpen } = useDialog();
  const showFailure = useFailureToast();

  const formSchema = z.object({
    firstName: z
      .string()
      .max(USER_FIRST_NAME_MAX_LENGTH)
      .default(user.firstName ?? ""),
    lastName: z
      .string()
      .max(USER_LAST_NAME_MAX_LENGTH)
      .default(user.lastName ?? ""),
    headline: z
      .string()
      .max(USER_HEADLINE_MAX_LENGTH)
      .default(user.headline ?? ""),
    phone: z
      .string()
      .max(USER_PHONE_MAX_LENGTH)
      .refine(value => value === "" || USER_PHONE_PATTERN.test(value), {
        message: tError("field_invalid_phone"),
      })
      .default(user.phone ?? ""),
    birthday: z.string().default(toDateInput(user.birthday)),
    showRealName: z.boolean().default(user.showRealName),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const result = await onUpdate(user.id, {
      birthday: values.birthday === "" ? null : values.birthday,
      firstName: emptyToNull(values.firstName),
      headline: emptyToNull(values.headline),
      lastName: emptyToNull(values.lastName),
      phone: emptyToNull(values.phone),
      showRealName: values.showRealName,
    });

    if ("error" in result) {
      showFailure();

      return;
    }

    setIsDirty?.(false);
    setOpen?.(false);
    toast.success(t("saved"), {
      description: t("savedDesc", { name: user.name }),
    });
  };

  return (
    <AutoForm
      fields={[
        {
          id: "firstName",
          component: props => (
            <AutoFormInput
              {...props}
              autoComplete="off"
              label={t("firstName")}
            />
          ),
        },
        {
          id: "lastName",
          component: props => (
            <AutoFormInput
              {...props}
              autoComplete="off"
              label={t("lastName")}
            />
          ),
        },
        {
          id: "headline",
          component: props => (
            <AutoFormInput
              {...props}
              autoComplete="off"
              description={t("headlineDesc", { max: USER_HEADLINE_MAX_LENGTH })}
              label={t("headline")}
            />
          ),
        },
        {
          id: "phone",
          component: props => (
            <AutoFormInput
              {...props}
              autoComplete="off"
              inputMode="tel"
              label={t("phone")}
              type="tel"
            />
          ),
        },
        {
          id: "birthday",
          component: props => (
            <AutoFormInput {...props} label={t("birthday")} type="date" />
          ),
        },
        {
          id: "showRealName",
          component: props => (
            <AutoFormSwitch
              {...props}
              description={t("showRealNameDesc")}
              label={t("showRealName")}
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      submitButtonProps={{ children: t("save") }}
    />
  );
};

export const PreferencesForm = ({
  onUpdate,
  user,
}: {
  onUpdate: UpdateAdminUser;
  user: AdminUserDetail;
}) => {
  const t = useTranslations("admin.user.show.preferences");
  const { setIsDirty, setOpen } = useDialog();
  const showFailure = useFailureToast();
  const languages = useLanguages();
  const zones = React.useMemo(() => supportedTimeZones(), []);
  const options = languages.some(language => language.code === user.language)
    ? languages
    : [...languages, { code: user.language, name: user.language }];
  const codes = options.map(language => language.code);
  const [firstCode = user.language, ...restCodes] = codes;

  const formSchema = z.object({
    language: z.enum([firstCode, ...restCodes]).default(user.language),
    timeZone: z
      .enum([AUTOMATIC_TIME_ZONE, ...zones])
      .default(user.timeZone ?? AUTOMATIC_TIME_ZONE),
    newsletter: z.boolean().default(user.newsletter),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const result = await onUpdate(user.id, {
      language: values.language,
      newsletter: values.newsletter,
      timeZone:
        values.timeZone === AUTOMATIC_TIME_ZONE ? null : values.timeZone,
    });

    if ("error" in result) {
      showFailure();

      return;
    }

    setIsDirty?.(false);
    setOpen?.(false);
    toast.success(t("saved"), {
      description: t("savedDesc", { name: user.name }),
    });
  };

  return (
    <AutoForm
      fields={[
        {
          id: "language",
          component: props => (
            <AutoFormSelect
              {...props}
              label={t("language")}
              labels={options.map(language => ({
                label: language.name,
                value: language.code,
              }))}
            />
          ),
        },
        {
          id: "timeZone",
          component: props => (
            <AutoFormCombobox
              {...props}
              description={t("timeZoneDesc")}
              label={t("timeZone")}
              labels={[
                { label: t("timeZoneAuto"), value: AUTOMATIC_TIME_ZONE },
                ...zones.map(zone => ({
                  label: timeZoneLabel(zone),
                  value: zone,
                })),
              ]}
            />
          ),
        },
        {
          id: "newsletter",
          component: props => (
            <AutoFormSwitch
              {...props}
              description={t("newsletterDesc")}
              label={t("newsletter")}
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      submitButtonProps={{ children: t("save") }}
    />
  );
};
