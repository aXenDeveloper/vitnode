import { Undo2Icon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";
import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import { AutoForm, AutoFormSubmitButton } from "@/components/form/auto-form";
import { AutoFormTextarea } from "@/components/form/fields/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

import type { FileAlt, FileAltLanguage, FileAltPolicy } from "./file-alt-query";

import { FILE_ALT_POLICIES } from "./file-alt-query";

type Write = Promise<AdminMutationResult<true>>;

export interface FileAltEditorProps {
  canEdit: boolean;
  data: FileAlt;
  onPolicyChange: (policy: FileAltPolicy) => Write;
  onRemove: (languageCode: string) => Write;
  onSave: (body: { languageCode: string; text: string }) => Write;
}

const isPolicy = (value: string): value is FileAltPolicy =>
  FILE_ALT_POLICIES.some(policy => policy === value);

const OriginBadges = ({ language }: { language: FileAltLanguage }) => {
  const t = useTranslations("admin.system.files.alt.origin");

  return (
    <span className="flex flex-wrap items-center gap-1">
      {language.origin === "ai" ? (
        <Badge variant="secondary">{t("ai")}</Badge>
      ) : language.origin === "human" ? (
        <Badge variant="success">{t("human")}</Badge>
      ) : (
        <Badge variant="warning">{t("missing")}</Badge>
      )}
      {language.stale ? <Badge variant="warning">{t("stale")}</Badge> : null}
    </span>
  );
};

const AltTextForm = ({
  language,
  onSave,
}: {
  language: FileAltLanguage;
  onSave: FileAltEditorProps["onSave"];
}) => {
  const t = useTranslations("admin.system.files.alt");
  const tError = useTranslations("core.global.errors");

  const formSchema = z.object({
    text: z
      .string()
      .max(1_000)
      .default(language.text ?? ""),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const result = await onSave({
      languageCode: language.code,
      text: values.text,
    });

    if ("error" in result) {
      toast.error(tError("title"), {
        description: tError("internal_server_error"),
      });

      return;
    }

    toast.success(t("saved.title"), {
      description:
        values.text.trim() === ""
          ? t("saved.desc_empty", { language: language.name })
          : t("saved.desc", { language: language.name }),
    });
  };

  return (
    <AutoForm
      className="flex flex-col gap-2"
      fields={[
        {
          component: props => (
            <AutoFormTextarea
              {...props}
              aria-label={t("text_label", { language: language.name })}
              rows={2}
            />
          ),
          id: "text",
        },
      ]}
      formSchema={formSchema}
      layout={fields => <>{fields.text}</>}
      onSubmit={onSubmit}
    >
      <div className="flex justify-end">
        <AutoFormSubmitButton variant="outline">
          {t("save")}
        </AutoFormSubmitButton>
      </div>
    </AutoForm>
  );
};

const RemoveAltButton = ({
  language,
  onRemove,
}: {
  language: FileAltLanguage;
  onRemove: FileAltEditorProps["onRemove"];
}) => {
  const t = useTranslations("admin.system.files.alt.remove");
  const tError = useTranslations("core.global.errors");
  const [isPending, startTransition] = React.useTransition();

  return (
    <Button
      isLoading={isPending}
      onClick={() => {
        startTransition(async () => {
          const result = await onRemove(language.code);
          if ("error" in result) {
            toast.error(tError("title"), {
              description: tError("internal_server_error"),
            });

            return;
          }

          toast.success(t("success"), {
            description: t("success_desc", { language: language.name }),
          });
        });
      }}
      size="sm"
      variant="ghost"
    >
      <Undo2Icon />
      {t("button")}
    </Button>
  );
};

const AltLanguageItem = ({
  canEdit,
  language,
  onRemove,
  onSave,
}: Pick<FileAltEditorProps, "canEdit" | "onRemove" | "onSave"> & {
  language: FileAltLanguage;
}) => {
  const t = useTranslations("admin.system.files.alt");

  return (
    <li className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-baseline gap-2">
          <span className="font-medium">{language.name}</span>
          <span className="text-muted-foreground font-mono text-xs">
            {language.code}
          </span>
        </span>
        <OriginBadges language={language} />
      </div>

      {language.text === "" ? (
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {t("intentionally_empty")}
        </p>
      ) : null}

      {canEdit ? (
        <>
          <AltTextForm language={language} onSave={onSave} />
          {language.text === null ? null : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground text-xs leading-relaxed text-pretty">
                {t("remove.hint")}
              </span>
              <RemoveAltButton language={language} onRemove={onRemove} />
            </div>
          )}
        </>
      ) : language.text ? (
        <p className="text-sm leading-relaxed text-pretty">{language.text}</p>
      ) : null}
    </li>
  );
};

const AltPolicySelect = ({
  canEdit,
  onPolicyChange,
  policy,
}: {
  canEdit: boolean;
  onPolicyChange: FileAltEditorProps["onPolicyChange"];
  policy: FileAltPolicy;
}) => {
  const t = useTranslations("admin.system.files.alt.policy");
  const tError = useTranslations("core.global.errors");
  const [isPending, startTransition] = React.useTransition();

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="file-alt-policy">{t("label")}</Label>
      <NativeSelect
        className="w-full sm:w-64"
        disabled={!canEdit || isPending}
        id="file-alt-policy"
        onChange={event => {
          const next = event.target.value;
          if (!isPolicy(next)) return;

          startTransition(async () => {
            const result = await onPolicyChange(next);
            if ("error" in result) {
              toast.error(tError("title"), {
                description: tError("internal_server_error"),
              });

              return;
            }

            toast.success(t("saved"), { description: t(`${next}.desc`) });
          });
        }}
        value={policy}
      >
        {FILE_ALT_POLICIES.map(value => (
          <NativeSelectOption key={value} value={value}>
            {t(`${value}.label`)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
        {t(`${policy}.desc`)}
      </p>
    </div>
  );
};

export const FileAltEditor = ({
  canEdit,
  data,
  onPolicyChange,
  onRemove,
  onSave,
}: FileAltEditorProps) => {
  const t = useTranslations("admin.system.files.alt");

  return (
    <div className="flex flex-col gap-6">
      <AltPolicySelect
        canEdit={canEdit}
        onPolicyChange={onPolicyChange}
        policy={data.altPolicy}
      />

      <section
        aria-labelledby="file-alt-languages"
        className="flex flex-col gap-2"
      >
        <h3 className="font-medium" id="file-alt-languages">
          {t("languages")}
        </h3>
        {canEdit ? (
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {t("empty_hint")}
          </p>
        ) : null}
        <ul className="divide-y">
          {data.languages.map(language => (
            <AltLanguageItem
              canEdit={canEdit}
              // A save or removal remounts the row, so its form starts from the
              // stored text rather than what was last typed.
              key={`${language.code}:${String(language.updatedAt)}:${language.origin}`}
              language={language}
              onRemove={onRemove}
              onSave={onSave}
            />
          ))}
        </ul>
      </section>
    </div>
  );
};
