import { SparklesIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type {
  AutoFormOnSubmit,
  ItemAutoFormComponentProps,
} from "@/components/form/auto-form";
import type { MultiLangPresence } from "@/components/form/fields/multi-lang-presence";
import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormSheetFooter } from "@/components/form/auto-form-sheet-footer";
import { multiLangValueSchema } from "@/components/form/fields/multi-lang";
import { useMultiLangSelected } from "@/components/form/fields/multi-lang-language";
import {
  MultiLangPresenceContext,
  MultiLangShownLanguageContext,
} from "@/components/form/fields/multi-lang-presence";
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
  fileName: string;
  onPolicyChange: (policy: FileAltPolicy) => Write;
  onRemove: (languageCode: string) => Write;
  onSave: (body: { languageCode: string; text: string }) => Write;
  onSaved: () => void;
}

const isPolicy = (value: unknown): value is FileAltPolicy =>
  FILE_ALT_POLICIES.some(policy => policy === value);

const needsAttention = (language: FileAltLanguage) =>
  language.text === null || language.stale;

const OriginBadge = ({ language }: { language: FileAltLanguage }) => {
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

const ShownLanguageBadge = ({
  languages,
}: {
  languages: FileAltLanguage[];
}) => {
  const selected = useMultiLangSelected();
  const language = languages.find(entry => entry.code === selected);

  return language ? <OriginBadge language={language} /> : null;
};

const PolicySelect = ({
  disabled,
  field,
}: ItemAutoFormComponentProps & { disabled: boolean }) => {
  const t = useTranslations("admin.system.files.alt.policy");
  const id = React.useId();
  const value: unknown = field.value;
  const policy = isPolicy(value) ? value : "automatic";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{t("label")}</Label>
        <NativeSelect
          className="w-36"
          disabled={disabled}
          id={id}
          onChange={event => {
            if (isPolicy(event.target.value)) {
              field.onChange(event.target.value);
            }
          }}
          size="sm"
          value={policy}
        >
          {FILE_ALT_POLICIES.map(option => (
            <NativeSelectOption key={option} value={option}>
              {t(`${option}.label`)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
        {t(`${policy}.desc`)}
      </p>
    </div>
  );
};

const RewriteAction = ({
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
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-muted-foreground text-xs leading-relaxed text-pretty">
        {t("hint")}
      </span>
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
        type="button"
        variant="ghost"
      >
        <SparklesIcon aria-hidden="true" />
        {t("button", { language: language.name })}
      </Button>
    </div>
  );
};

const submitOnModEnter = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }
};

export const FileAltEditor = ({
  canEdit,
  data,
  fileName,
  onPolicyChange,
  onRemove,
  onSave,
  onSaved,
}: FileAltEditorProps) => {
  const t = useTranslations("admin.system.files.alt");
  const tOrigin = useTranslations("admin.system.files.alt.origin");
  const tError = useTranslations("core.global.errors");
  const [shown, setShown] = React.useState<null | string>(null);
  const shownLanguage = data.languages.find(entry => entry.code === shown);

  const presence = React.useMemo<MultiLangPresence>(
    () => ({
      busy: () => false,
      marker: code => {
        const language = data.languages.find(entry => entry.code === code);
        if (!language || !needsAttention(language)) return null;

        return (
          <span className="text-muted-foreground ms-2 text-xs">
            {language.stale ? tOrigin("stale") : tOrigin("missing")}
          </span>
        );
      },
    }),
    [data.languages, tOrigin],
  );

  const storedText = (code: string) =>
    data.languages.find(language => language.code === code)?.text ?? "";

  const formSchema = z.object({
    altText: multiLangValueSchema({ maxLength: 1_000 }).default(
      data.languages.map(language => ({
        languageCode: language.code,
        value: language.text ?? "",
      })),
    ),
    altPolicy: z.enum(FILE_ALT_POLICIES).default(data.altPolicy),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const writes: Write[] = values.altText
      .filter(entry => entry.value !== storedText(entry.languageCode))
      .map(
        async entry =>
          await onSave({ languageCode: entry.languageCode, text: entry.value }),
      );
    if (values.altPolicy !== data.altPolicy) {
      writes.push(onPolicyChange(values.altPolicy));
    }

    const results = await Promise.all(writes);
    if (results.some(result => "error" in result)) {
      toast.error(tError("title"), {
        description: tError("internal_server_error"),
      });

      return;
    }

    toast.success(t("saved.title"), {
      description: t("saved.desc", { count: writes.length, name: fileName }),
    });
    onSaved();
  };

  return (
    <MultiLangPresenceContext value={presence}>
      <MultiLangShownLanguageContext value={setShown}>
        <AutoForm
          className="flex min-h-0 flex-1 flex-col gap-0"
          fields={[
            {
              component: props => (
                <AutoFormTextarea
                  {...props}
                  disabled={!canEdit}
                  label={t("description")}
                  labelRight={<ShownLanguageBadge languages={data.languages} />}
                  multiLang
                  onKeyDown={submitOnModEnter}
                  placeholder={t("placeholder")}
                  rows={4}
                />
              ),
              id: "altText",
            },
            {
              component: props => (
                <PolicySelect {...props} disabled={!canEdit} />
              ),
              id: "altPolicy",
            },
          ]}
          formSchema={formSchema}
          layout={rendered => (
            <>
              <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
                <div className="flex flex-col gap-2">{rendered.altText}</div>
                <div className="flex flex-col gap-2">
                  <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
                    {t("empty_hint")}
                  </p>
                  {canEdit && shownLanguage && shownLanguage.text !== null ? (
                    <RewriteAction
                      key={shownLanguage.code}
                      language={shownLanguage}
                      onRemove={onRemove}
                    />
                  ) : null}
                </div>
                <div className="border-t pt-4">{rendered.altPolicy}</div>
              </div>
              {canEdit ? <AutoFormSheetFooter submitLabel={t("save")} /> : null}
            </>
          )}
          onSubmit={onSubmit}
        />
      </MultiLangShownLanguageContext>
    </MultiLangPresenceContext>
  );
};
