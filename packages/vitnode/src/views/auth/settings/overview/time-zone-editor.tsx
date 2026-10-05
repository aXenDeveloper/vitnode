import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";

import { AutoForm, AutoFormSubmitButton } from "@/components/form/auto-form";
import { AutoFormCombobox } from "@/components/form/fields/combobox";
import { Button } from "@/components/ui/button";

import type { UpdateTimeZone } from "./time-zone-update";

import {
  deviceTimeZone,
  supportedTimeZones,
  timeZoneLabel,
} from "./time-zone-update";

export const TimeZoneEditor = ({
  onClose,
  onUpdate,
  value,
}: {
  onClose: () => void;
  onUpdate: UpdateTimeZone;
  value: null | string;
}) => {
  const t = useTranslations("core.auth.settings.overview");
  const tGlobal = useTranslations("core.global");
  const tError = useTranslations("core.global.errors");
  const zones = React.useMemo(() => supportedTimeZones(), []);
  const device = React.useMemo(() => deviceTimeZone(), []);
  const [isUsingDevice, setIsUsingDevice] = React.useState(false);

  const save = async (timeZone: null | string) => {
    const result = await onUpdate(timeZone);

    if (result.error) {
      toast.error(tError("title"), {
        description: tError("internal_server_error"),
      });

      return;
    }

    toast.success(t("timeZoneSaved"), {
      description: timeZone
        ? t("timeZoneSavedDesc", { timeZone: timeZoneLabel(timeZone) })
        : t("timeZoneAuto"),
    });
    onClose();
  };

  const formSchema = z.object({
    value: z
      .enum(zones as [string, ...string[]])
      .default(value ?? device ?? "UTC"),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    await save(values.value);
  };

  return (
    <AutoForm
      className="flex flex-col gap-3 space-y-0 px-4 py-4"
      fields={[
        {
          component: props => (
            <AutoFormCombobox
              {...props}
              description={t("timeZoneDesc")}
              label={t("timeZone")}
            />
          ),
          id: "value",
        },
      ]}
      formSchema={formSchema}
      layout={rendered => (
        <>
          {rendered.value}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {device && device !== value ? (
              <Button
                className="h-auto px-0"
                isLoading={isUsingDevice}
                onClick={() => {
                  setIsUsingDevice(true);
                  void save(device).finally(() => {
                    setIsUsingDevice(false);
                  });
                }}
                type="button"
                variant="link"
              >
                {t("timeZoneUseDevice", { timeZone: timeZoneLabel(device) })}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button onClick={onClose} type="button" variant="ghost">
                {tGlobal("cancel")}
              </Button>
              <AutoFormSubmitButton>{t("save")}</AutoFormSubmitButton>
            </div>
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
