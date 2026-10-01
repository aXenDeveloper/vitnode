import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";
import type { SsoProfileField } from "@/lib/sso-profile";

import { AutoForm, AutoFormSubmitButton } from "@/components/form/auto-form";
import { AutoFormCheckbox } from "@/components/form/fields/checkbox";
import { Button } from "@/components/ui/button";

import type { ApplySsoImport } from "./sso-connections-mutations";
import type {
  SsoConnectionProvider,
  SsoImportPreviewApi,
  SsoImportPreviewField,
} from "./sso-connections-query";

import { previewFieldState } from "./profile-field-state";

const previewFieldId = (field: SsoProfileField) => `preview_${field}`;

const isSelectable = (field: SsoImportPreviewField) =>
  previewFieldState(field) === "selectable";

const AvatarComparison = ({
  currentAvatarUrl,
  incoming,
  providerName,
}: {
  currentAvatarUrl: null | string;
  incoming: string;
  providerName: string;
}) => {
  const t = useTranslations("core.auth.settings.sso.preview");

  return (
    <span className="flex items-center gap-4">
      <span className="flex flex-col items-center gap-1">
        {currentAvatarUrl ? (
          <img
            alt={t("current")}
            className="size-12 rounded-full object-cover"
            src={currentAvatarUrl}
          />
        ) : (
          <span className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full text-xs">
            {t("empty_value")}
          </span>
        )}
        <span className="text-muted-foreground text-xs">{t("current")}</span>
      </span>
      <span aria-hidden="true" className="text-muted-foreground">
        →
      </span>
      <span className="flex flex-col items-center gap-1">
        <img
          alt={t("incoming", { provider: providerName })}
          className="size-12 rounded-full object-cover"
          referrerPolicy="no-referrer"
          src={incoming}
        />
        <span className="text-muted-foreground text-xs">
          {t("incoming", { provider: providerName })}
        </span>
      </span>
    </span>
  );
};

export const ImportPreviewForm = ({
  currentAvatarUrl,
  onApply,
  onClose,
  preview,
  providerId,
  providerName,
  providers,
}: {
  currentAvatarUrl: null | string;
  onApply: ApplySsoImport;
  onClose: () => void;
  preview: SsoImportPreviewApi;
  providerId: string;
  providerName: string;
  providers: SsoConnectionProvider[];
}) => {
  const t = useTranslations("core.auth.settings.sso");
  const tErrors = useTranslations("core.global.errors");
  const selectable = preview.fields.filter(isSelectable);
  const blocked = preview.fields.filter(field => !isSelectable(field));
  const nameOf = (id: string) =>
    providers.find(provider => provider.id === id)?.name ?? id;
  const fieldList = (fields: SsoProfileField[]) =>
    fields.map(field => t(`fields.${field}`)).join(", ");

  const formSchema = z.object(
    Object.fromEntries(
      selectable.map(field => [
        previewFieldId(field.field),
        z.boolean().default(true),
      ]),
    ),
  );

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const fields = selectable
      .map(field => field.field)
      .filter(field => values[previewFieldId(field)]);

    if (fields.length === 0) {
      toast.error(t("import.pick_one"));

      return;
    }

    const result = await onApply({ fields, providerId });

    if (!result.ok) {
      if (result.failure === "server_error") {
        toast.error(tErrors("title"), {
          description: tErrors("internal_server_error"),
        });

        return;
      }

      toast.error(t(`errors.${result.failure}.title`), {
        description: t(`errors.${result.failure}.desc`, {
          provider: providerName,
        }),
      });
      onClose();

      return;
    }

    const updated = fields.filter(field => result.results[field] === "updated");
    const notes = [
      ...(result.results.avatar === "failed"
        ? [t("preview.avatar_failed")]
        : []),
      ...(result.manualFields.length > 0
        ? [t("preview.manual_note", { fields: fieldList(result.manualFields) })]
        : []),
    ];

    if (updated.length > 0) {
      toast.success(t("preview.success"), {
        description: [
          t("preview.success_desc", {
            fields: fieldList(updated),
            provider: providerName,
          }),
          ...notes,
        ].join(" "),
      });
    } else if (result.results.avatar === "failed") {
      toast.error(t("preview.avatar_failed"));
    } else {
      toast.info(t("preview.unchanged"));
    }

    onClose();
  };

  const describe = (field: SsoImportPreviewField) => {
    const sourcedElsewhere =
      field.source && field.source !== providerId
        ? t("preview.sourced_elsewhere", { source: nameOf(field.source) })
        : null;

    if (field.field === "avatar" && field.incoming) {
      return (
        <span className="flex flex-col gap-2">
          <AvatarComparison
            currentAvatarUrl={currentAvatarUrl}
            incoming={field.incoming}
            providerName={providerName}
          />
          {sourcedElsewhere}
        </span>
      );
    }

    return (
      <span className="flex flex-col gap-1">
        <span>
          {t("preview.current")}: {field.current ?? t("preview.empty_value")} →{" "}
          {t("preview.incoming", { provider: providerName })}:{" "}
          <span className="text-foreground font-medium">{field.incoming}</span>
        </span>
        {sourcedElsewhere}
      </span>
    );
  };

  if (selectable.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {t("preview.nothing", { provider: providerName })}
        </p>
        <div className="flex justify-end">
          <Button onClick={onClose} variant="outline">
            {t("preview.discard")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AutoForm
      className="flex flex-col gap-4 space-y-0"
      fields={selectable.map(field => ({
        component: props => (
          <AutoFormCheckbox
            {...props}
            description={describe(field)}
            label={t(`fields.${field.field}`)}
          />
        ),
        id: previewFieldId(field.field),
      }))}
      formSchema={formSchema}
      layout={rendered => (
        <>
          <fieldset className="flex flex-col gap-4">
            <legend className="sr-only">{t("import.fields_legend")}</legend>
            {selectable.map(
              async field => rendered[previewFieldId(field.field)],
            )}
          </fieldset>

          {blocked.length > 0 ? (
            <ul className="text-muted-foreground flex flex-col gap-1 text-sm leading-relaxed">
              {blocked.map(field => (
                <li key={field.field}>
                  <span className="text-foreground font-medium">
                    {t(`fields.${field.field}`)}:
                  </span>{" "}
                  {previewFieldState(field) === "missing"
                    ? t("preview.missing", { provider: providerName })
                    : t("preview.not_allowed")}
                </li>
              ))}
            </ul>
          ) : null}

          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {t("sync.manual_edit_note")}
          </p>

          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={onClose} type="button" variant="ghost">
              {t("preview.discard")}
            </Button>
            <AutoFormSubmitButton>{t("preview.apply")}</AutoFormSubmitButton>
          </div>
        </>
      )}
      onSubmit={onSubmit}
    />
  );
};
