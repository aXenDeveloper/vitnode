import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";
import type { SsoProfileField } from "@/lib/sso-profile";

import { AutoForm, AutoFormSubmitButton } from "@/components/form/auto-form";
import { AutoFormCheckbox } from "@/components/form/fields/checkbox";
import { SSO_PROFILE_FIELDS } from "@/lib/sso-profile";

import type { StartSsoConnection } from "./sso-connections-mutations";

import { useStartFailureToast } from "./sso-start-feedback";

const importFieldId = (field: SsoProfileField) => `import_${field}`;

export const ImportFieldsForm = ({
  fields,
  onStart,
  providerId,
  providerName,
}: {
  fields: SsoProfileField[];
  onStart: StartSsoConnection;
  providerId: string;
  providerName: string;
}) => {
  const t = useTranslations("core.auth.settings.sso");
  const showFailure = useStartFailureToast(providerName);
  const supported = SSO_PROFILE_FIELDS.filter(field => fields.includes(field));

  const formSchema = z.object(
    Object.fromEntries(
      supported.map(field => [importFieldId(field), z.boolean().default(true)]),
    ),
  );

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const selected = supported.filter(field => values[importFieldId(field)]);

    if (selected.length === 0) {
      toast.error(t("import.pick_one"));

      return;
    }

    const result = await onStart({
      fields: selected,
      intent: "import",
      providerId,
    });
    showFailure(result);
  };

  return (
    <AutoForm
      className="flex flex-col gap-4 space-y-0"
      fields={supported.map(field => ({
        component: props => (
          <AutoFormCheckbox
            {...props}
            description={t(`fields.${field}_desc`)}
            label={t(`fields.${field}`)}
          />
        ),
        id: importFieldId(field),
      }))}
      formSchema={formSchema}
      layout={rendered => (
        <>
          <fieldset className="flex flex-col gap-4">
            <legend className="text-foreground mb-2 text-sm font-medium">
              {t("import.fields_legend")}
            </legend>
            {supported.map(async field => rendered[importFieldId(field)])}
          </fieldset>
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {t("import.redirect_note", { provider: providerName })}
          </p>
          <div className="flex justify-end">
            <AutoFormSubmitButton>
              {t("import.continue", { provider: providerName })}
            </AutoFormSubmitButton>
          </div>
        </>
      )}
      onSubmit={onSubmit}
    />
  );
};
