import { PhoneIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";
import type { UserPersonalInformationTextField } from "@/lib/user-personal-information";

import { AutoForm, AutoFormSubmitButton } from "@/components/form/auto-form";
import { AutoFormInput } from "@/components/form/fields/input";
import { Button } from "@/components/ui/button";
import { InputGroupAddon } from "@/components/ui/input-group";
import {
  USER_FIRST_NAME_MAX_LENGTH,
  USER_HEADLINE_MAX_LENGTH,
  USER_LAST_NAME_MAX_LENGTH,
  USER_PHONE_MAX_LENGTH,
  USER_PHONE_PATTERN,
} from "@/lib/user-personal-information";

import type {
  UpdatePersonalInformation,
  UpdatePersonalInformationInput,
} from "./personal-update";

const FIELD_INPUTS: Record<
  UserPersonalInformationTextField,
  { autoComplete: string; max: number }
> = {
  firstName: { autoComplete: "given-name", max: USER_FIRST_NAME_MAX_LENGTH },
  headline: { autoComplete: "off", max: USER_HEADLINE_MAX_LENGTH },
  lastName: { autoComplete: "family-name", max: USER_LAST_NAME_MAX_LENGTH },
  phone: { autoComplete: "tel", max: USER_PHONE_MAX_LENGTH },
};

export const PersonalFieldEditor = ({
  field,
  onClose,
  onUpdate,
  value,
}: {
  field: UserPersonalInformationTextField;
  onClose: () => void;
  onUpdate: UpdatePersonalInformation;
  value: null | string;
}) => {
  const t = useTranslations("core.auth.settings.overview");
  const tGlobal = useTranslations("core.global");
  const tError = useTranslations("core.global.errors");
  const { autoComplete, max } = FIELD_INPUTS[field];
  const isPhone = field === "phone";
  const [autoFocus] = React.useState(
    () => !window.matchMedia("(pointer: coarse)").matches,
  );

  const text = z.string().max(max);
  const formSchema = z.object({
    value: (isPhone
      ? text.refine(next => next === "" || USER_PHONE_PATTERN.test(next), {
          message: tError("field_invalid_phone"),
        })
      : text
    ).default(value ?? ""),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const input: UpdatePersonalInformationInput = {};
    input[field] = values.value;
    const result = await onUpdate(input);

    if (result.error) {
      toast.error(tError("title"), {
        description: tError("internal_server_error"),
      });

      return;
    }

    toast.success(t("saved"), { description: t("savedDesc") });
    onClose();
  };

  return (
    <AutoForm
      className="flex flex-col gap-3 space-y-0 px-4 py-4"
      fields={[
        {
          component: props => (
            <AutoFormInput
              {...props}
              autoComplete={autoComplete}
              autoFocus={autoFocus}
              description={
                field === "headline"
                  ? t("headlineDesc", { max: USER_HEADLINE_MAX_LENGTH })
                  : undefined
              }
              label={t(field)}
              {...(isPhone
                ? {
                    inputMode: "tel",
                    placeholder: "+48 600 700 800",
                    type: "tel",
                  }
                : {})}
            >
              {isPhone ? (
                <InputGroupAddon>
                  <PhoneIcon />
                </InputGroupAddon>
              ) : null}
            </AutoFormInput>
          ),
          id: "value",
        },
      ]}
      formSchema={formSchema}
      layout={rendered => (
        <>
          {rendered.value}
          <div className="flex justify-end gap-2">
            <Button onClick={onClose} type="button" variant="ghost">
              {tGlobal("cancel")}
            </Button>
            <AutoFormSubmitButton>{t("save")}</AutoFormSubmitButton>
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
