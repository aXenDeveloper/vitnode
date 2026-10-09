import { useSelector } from "@tanstack/react-form";
import { PhoneIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";
import type { PersonalInformationFields } from "@/lib/user-personal-information";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormSheetFooter } from "@/components/form/auto-form-sheet-footer";
import { AutoFormCombobox } from "@/components/form/fields/combobox";
import { AutoFormInput } from "@/components/form/fields/input";
import { AutoFormSwitch } from "@/components/form/fields/switch";
import { Button } from "@/components/ui/button";
import { useFormApi } from "@/components/ui/form";
import { InputGroupAddon } from "@/components/ui/input-group";
import {
  PERSONAL_INFORMATION_TEXT_FIELDS,
  USER_FIRST_NAME_MAX_LENGTH,
  USER_HEADLINE_MAX_LENGTH,
  USER_LAST_NAME_MAX_LENGTH,
  USER_PHONE_MAX_LENGTH,
  USER_PHONE_PATTERN,
} from "@/lib/user-personal-information";

import type { UpdatePersonalInformation } from "./personal-update";
import type { ProfileSummaryUser } from "./profile-summary";
import type { UpdateTimeZone } from "./time-zone-update";

import { profileChanges } from "./profile-changes";
import {
  deviceTimeZone,
  supportedTimeZones,
  timeZoneLabel,
} from "./time-zone-update";

const TEXT_INPUTS = {
  firstName: { autoComplete: "given-name" },
  headline: { autoComplete: "off" },
  lastName: { autoComplete: "family-name" },
  phone: {
    autoComplete: "tel",
    inputMode: "tel",
    placeholder: "+48 600 700 800",
    type: "tel",
  },
} as const;

const UseDeviceTimeZone = ({ device }: { device: null | string }) => {
  const t = useTranslations("core.auth.settings.overview");
  const { form } = useFormApi();
  const value = useSelector(form.store, state => state.values.timeZone);

  if (!device || device === value) return null;

  return (
    <Button
      className="h-auto self-start px-0 text-start whitespace-normal"
      onClick={() => {
        form.setFieldValue("timeZone", device);
      }}
      type="button"
      variant="link"
    >
      {t("timeZoneUseDevice", { timeZone: timeZoneLabel(device) })}
    </Button>
  );
};

export interface ProfileSheetFormProps {
  canEdit: boolean;
  fields: PersonalInformationFields;
  onDone: () => void;
  onTimeZoneUpdate: UpdateTimeZone;
  onUpdate: UpdatePersonalInformation;
  user: ProfileSummaryUser;
}

export const ProfileSheetForm = ({
  canEdit,
  fields,
  onDone,
  onTimeZoneUpdate,
  onUpdate,
  user,
}: ProfileSheetFormProps) => {
  const t = useTranslations("core.auth.settings.overview");
  const tError = useTranslations("core.global.errors");
  const headingId = React.useId();
  const zones = React.useMemo(() => supportedTimeZones(), []);
  const zoneLabels = React.useMemo(
    () => zones.map(zone => ({ label: timeZoneLabel(zone), value: zone })),
    [zones],
  );
  const [device] = React.useState(deviceTimeZone);
  const initialTimeZone = user.timeZone ?? device ?? "UTC";
  const textFields = canEdit
    ? PERSONAL_INFORMATION_TEXT_FIELDS.filter(field => fields[field])
    : [];
  const hasRealName = canEdit && fields.showRealName;

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
      .refine(
        value => value.trim() === "" || USER_PHONE_PATTERN.test(value.trim()),
        { message: tError("field_invalid_phone") },
      )
      .default(user.phone ?? ""),
    headline: z
      .string()
      .max(USER_HEADLINE_MAX_LENGTH)
      .default(user.headline ?? ""),
    showRealName: z.boolean().default(user.showRealName),
    timeZone: z.enum(zones as [string, ...string[]]).default(initialTimeZone),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const changes = profileChanges({
      canEdit,
      fields,
      initialTimeZone,
      user,
      values,
    });
    const results = await Promise.all([
      changes.personal ? onUpdate(changes.personal) : null,
      changes.timeZone === undefined
        ? null
        : onTimeZoneUpdate(changes.timeZone),
    ]);

    if (results.some(result => result?.error)) {
      toast.error(tError("title"), {
        description: tError("internal_server_error"),
      });

      return;
    }

    toast.success(t("saved"), { description: t("savedDesc") });
    onDone();
  };

  return (
    <AutoForm
      className="flex min-h-0 flex-1 flex-col gap-0"
      fields={[
        ...textFields.map(field => ({
          component: (props: React.ComponentProps<typeof AutoFormInput>) => (
            <AutoFormInput
              {...props}
              {...TEXT_INPUTS[field]}
              description={
                field === "headline"
                  ? t("headlineDesc", { max: USER_HEADLINE_MAX_LENGTH })
                  : undefined
              }
              label={t(field)}
            >
              {field === "phone" ? (
                <InputGroupAddon>
                  <PhoneIcon />
                </InputGroupAddon>
              ) : null}
            </AutoFormInput>
          ),
          id: field,
        })),
        ...(hasRealName
          ? [
              {
                component: (
                  props: React.ComponentProps<typeof AutoFormSwitch>,
                ) => (
                  <AutoFormSwitch
                    {...props}
                    description={t("showRealNameDesc")}
                    label={t("showRealName")}
                  />
                ),
                id: "showRealName",
              },
            ]
          : []),
        {
          component: props => (
            <AutoFormCombobox
              {...props}
              description={t("timeZoneDesc")}
              label={t("timeZone")}
              labels={zoneLabels}
            />
          ),
          id: "timeZone",
        },
      ]}
      formSchema={formSchema}
      layout={rendered => (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-4 py-5">
            {textFields.length > 0 || hasRealName ? (
              <section
                aria-labelledby={`${headingId}-personal`}
                className="flex flex-col gap-5"
              >
                <h3
                  className="text-base font-semibold text-balance"
                  id={`${headingId}-personal`}
                >
                  {t("personalTitle")}
                </h3>
                {textFields.map(field => (
                  <React.Fragment key={field}>{rendered[field]}</React.Fragment>
                ))}
                {rendered.showRealName}
              </section>
            ) : null}
            <section
              aria-labelledby={`${headingId}-region`}
              className="flex flex-col gap-5 border-t pt-6 first:border-t-0 first:pt-0"
            >
              <div className="flex flex-col gap-1">
                <h3
                  className="text-base font-semibold text-balance"
                  id={`${headingId}-region`}
                >
                  {t("regionTitle")}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                  {t("regionDesc")}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {rendered.timeZone}
                <UseDeviceTimeZone device={device} />
              </div>
            </section>
          </div>
          <AutoFormSheetFooter submitLabel={t("save")} />
        </>
      )}
      onSubmit={onSubmit}
    />
  );
};
