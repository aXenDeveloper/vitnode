import type { RichTextDocument } from "@vitnode/api/content/rich-text/document";
import type { LegalDocumentType } from "@vitnode/api/lib/legal/contract";

import { useSelector } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import {
  isRichTextDocument,
  isRichTextEmpty,
} from "@vitnode/api/content/rich-text/document";
import { localizeLegalContent } from "@vitnode/api/lib/legal/contract";
import {
  CopyIcon,
  EyeIcon,
  FilePlusIcon,
  MailIcon,
  PencilIcon,
  RotateCwIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";

import { AutoForm, AutoFormSubmitButton } from "@/components/form/auto-form";
import { AutoFormDateTime } from "@/components/form/fields/date-time";
import { AutoFormEditor } from "@/components/form/fields/editor";
import { AutoFormInput } from "@/components/form/fields/input";
import { AutoFormSwitch } from "@/components/form/fields/switch";
import { AutoFormTextarea } from "@/components/form/fields/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useFormApi } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsPanels,
  TabsTrigger,
} from "@/components/ui/tabs";
import { LegalDocumentView } from "@/views/legal/legal-document-view";
import { useLegalDate } from "@/views/legal/legal-format";
import { getVitNodeConfig } from "@/vitnode.config";

import type {
  AdminLegalDraft,
  AdminLegalDraftContext,
} from "./legal-admin-query";

import {
  adminLegalEmailPreviewQueryOptions,
  createAdminLegalDraft,
  deleteAdminLegalDraft,
  saveAdminLegalDraft,
} from "./legal-admin-query";

const LegalPublishDialog = React.lazy(async () =>
  import("./legal-publish-dialog").then(module => ({
    default: module.LegalPublishDialog,
  })),
);

const documentSchema = z.looseObject({
  content: z.array(z.unknown()).optional(),
  type: z.literal("doc"),
});

const textValues = z.array(
  z.object({ languageCode: z.string(), value: z.string() }),
);

interface DraftFormValues {
  acceptanceLabel: { languageCode: string; value: string }[];
  body: { languageCode: string; value: unknown }[];
  effectiveAt: null | string;
  requiresAcceptance: boolean;
  summary: { languageCode: string; value: string }[];
  title: { languageCode: string; value: string }[];
}

const filledText = (values: DraftFormValues["title"]) =>
  values.flatMap(item =>
    item.value.trim() === ""
      ? []
      : [{ languageCode: item.languageCode, value: item.value.trim() }],
  );

const filledBody = (
  values: DraftFormValues["body"],
): { languageCode: string; value: RichTextDocument }[] =>
  values.flatMap(({ languageCode, value }) =>
    isRichTextDocument(value) && !isRichTextEmpty(value)
      ? [{ languageCode, value }]
      : [],
  );

const nowIso = (): string => new Date().toISOString();

const isFutureIso = (iso: string): boolean => Date.parse(iso) > Date.now();

const useDraftValues = (): DraftFormValues => {
  const { form } = useFormApi();

  return useSelector(form.store, state => state.values as DraftFormValues);
};

const useDraftDirty = (): boolean => {
  const { form } = useFormApi();

  return useSelector(form.store, state => !state.isDefaultValue);
};

const LocaleSelect = ({
  id,
  onChange,
  value,
}: {
  id: string;
  onChange: (value: string) => void;
  value: string;
}) => {
  const t = useTranslations("admin.system.legal.editor");
  const { locales } = getVitNodeConfig().i18n;

  return (
    <div className="flex flex-col gap-2 sm:max-w-xs">
      <Label htmlFor={id}>{t("preview_locale")}</Label>
      <NativeSelect
        id={id}
        onChange={event => {
          onChange(event.target.value);
        }}
        value={value}
      >
        {locales.map(locale => (
          <NativeSelectOption key={locale.code} value={locale.code}>
            {locale.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
};

/** The exact public rendering of the unsaved draft, in one language. */
const DraftPreview = ({
  documentType,
  nextVersion,
}: {
  documentType: LegalDocumentType;
  nextVersion: number;
}) => {
  const values = useDraftValues();
  const defaultLanguage = getVitNodeConfig().i18n.defaultLocale;
  const [locale, setLocale] = React.useState(defaultLanguage);
  const content = {
    acceptanceLabel: filledText(values.acceptanceLabel),
    body: filledBody(values.body),
    summary: filledText(values.summary),
    title: filledText(values.title),
  };
  const snapshot = localizeLegalContent(content, locale, defaultLanguage);
  const [renderedAt] = React.useState(nowIso);
  const effectiveAt = values.effectiveAt ?? renderedAt;

  return (
    <div className="flex flex-col gap-6">
      <LocaleSelect
        id="legal-preview-locale"
        onChange={setLocale}
        value={locale}
      />
      <div className="rounded-xl border p-6">
        <LegalDocumentView
          current={null}
          document={{
            ...snapshot,
            announcedAt: renderedAt,
            availableLocales: [],
            contentHash: "",
            documentType,
            effectiveAt,
            id: 0,
            previousVersion: nextVersion > 1 ? nextVersion - 1 : null,
            requiresAcceptance: values.requiresAcceptance,
            status: isFutureIso(effectiveAt) ? "upcoming" : "current",
            version: nextVersion,
          }}
          preview
          upcoming={null}
        />
      </div>
    </div>
  );
};

/** The announcement email as members get it, rendered by the API. */
const EmailPreview = ({
  documentType,
  revision,
}: {
  documentType: LegalDocumentType;
  revision: number;
}) => {
  const t = useTranslations("admin.system.legal");
  const dirty = useDraftDirty();
  const [locale, setLocale] = React.useState(
    getVitNodeConfig().i18n.defaultLocale,
  );
  const query = useQuery(
    adminLegalEmailPreviewQueryOptions({ documentType, locale, revision }),
  );

  return (
    <div className="flex flex-col gap-4">
      <LocaleSelect
        id="legal-email-locale"
        onChange={setLocale}
        value={locale}
      />
      {dirty ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("editor.email_saved_only")}
        </p>
      ) : null}
      {query.isPending ? (
        <div aria-busy="true" className="flex flex-col gap-3">
          <span className="sr-only" role="status">
            {t("editor.email_preview")}
          </span>
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : query.isError ? (
        <Empty className="border" role="alert">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MailIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t("load_error.title")}</EmptyTitle>
            <EmptyDescription>{t("load_error.desc")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              isLoading={query.isFetching}
              onClick={() => void query.refetch()}
              variant="outline"
            >
              <RotateCwIcon aria-hidden="true" />
              {t("retry")}
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="font-medium">{query.data.subject}</p>
          <iframe
            className="h-160 w-full rounded-xl border bg-white"
            sandbox=""
            srcDoc={query.data.html}
            title={t("editor.email_preview")}
          />
        </div>
      )}
    </div>
  );
};

const DiscardDraftButton = ({
  documentType,
  onChanged,
}: {
  documentType: LegalDocumentType;
  onChanged: () => Promise<void>;
}) => {
  const t = useTranslations("admin.system.legal.editor");
  const tError = useTranslations("core.global.errors");
  const [pending, setPending] = React.useState(false);

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="ghost" />}>
        <Trash2Icon aria-hidden="true" />
        {t("discard")}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("discard_confirm.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("discard_confirm.desc")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel />
          <AlertDialogAction
            disabled={pending}
            onClick={async () => {
              setPending(true);
              try {
                const result = await deleteAdminLegalDraft(documentType);
                if (!result.ok) {
                  toast.error(tError("title"), {
                    description: tError("internal_server_error"),
                  });

                  return;
                }
                toast.success(t("toast.discarded.title"), {
                  description: t("toast.discarded.desc"),
                });
                await onChanged();
              } finally {
                setPending(false);
              }
            }}
            variant="destructive"
          >
            <Trash2Icon aria-hidden="true" />
            {t("discard_confirm.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const ActionBar = ({
  canEdit,
  canPublish,
  context,
  documentType,
  draft,
  onChanged,
}: {
  canEdit: boolean;
  canPublish: boolean;
  context: AdminLegalDraftContext;
  documentType: LegalDocumentType;
  draft: AdminLegalDraft;
  onChanged: () => Promise<void>;
}) => {
  const t = useTranslations("admin.system.legal.editor");
  const dirty = useDraftDirty();

  return (
    <div className="bg-background sticky bottom-0 flex flex-col gap-2 border-t py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-2">
        {canEdit ? (
          <AutoFormSubmitButton disabled={!dirty}>
            <SaveIcon aria-hidden="true" />
            {t("save")}
          </AutoFormSubmitButton>
        ) : null}
        {canPublish ? (
          <React.Suspense
            fallback={<Skeleton className="h-9 w-32 rounded-md" />}
          >
            <LegalPublishDialog
              context={context}
              disabled={dirty}
              documentType={documentType}
              draft={draft}
              onPublished={onChanged}
            />
          </React.Suspense>
        ) : null}
      </div>
      {canEdit ? (
        <DiscardDraftButton documentType={documentType} onChanged={onChanged} />
      ) : null}
    </div>
  );
};

const DraftForm = ({
  canEdit,
  canPublish,
  context,
  documentType,
  draft,
  onChanged,
}: {
  canEdit: boolean;
  canPublish: boolean;
  context: AdminLegalDraftContext;
  documentType: LegalDocumentType;
  draft: AdminLegalDraft;
  onChanged: () => Promise<void>;
}) => {
  const t = useTranslations("admin.system.legal");
  const tError = useTranslations("core.global.errors");
  const formatDate = useLegalDate();
  const isTerms = documentType === "terms";

  const formSchema = z.object({
    title: textValues.default(draft.title),
    summary: textValues.default(draft.summary),
    body: z
      .array(z.object({ languageCode: z.string(), value: documentSchema }))
      .default(
        draft.body.map(item => ({
          languageCode: item.languageCode,
          value: { ...item.value },
        })),
      ),
    acceptanceLabel: textValues.default(draft.acceptanceLabel),
    requiresAcceptance: z
      .boolean()
      .default(context.acceptanceForced || draft.requiresAcceptance),
    effectiveAt: z.string().nullable().default(draft.effectiveAt),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async (
    values,
    formApi,
  ) => {
    const result = await saveAdminLegalDraft(documentType, {
      acceptanceLabel: filledText(values.acceptanceLabel),
      body: filledBody(values.body),
      effectiveAt: values.effectiveAt,
      requiresAcceptance: isTerms && values.requiresAcceptance,
      revision: draft.revision,
      summary: filledText(values.summary),
      title: filledText(values.title),
    });
    if (!result.ok) {
      if (result.code === "LEGAL_DRAFT_CONFLICT") {
        toast.error(t("editor.toast.conflict.title"), {
          description: t("editor.toast.conflict.desc"),
        });

        return;
      }
      toast.error(tError("title"), {
        description: tError("internal_server_error"),
      });

      return;
    }

    formApi.reset(formApi.state.values);
    toast.success(t("editor.toast.saved.title"), {
      description: t("editor.toast.saved.desc"),
    });
    await onChanged();
  };

  return (
    <AutoForm
      className="flex flex-col gap-0"
      fields={[
        {
          id: "title",
          component: props => (
            <AutoFormInput
              {...props}
              description={t("editor.title.desc")}
              disabled={!canEdit}
              label={t("editor.title.label")}
              multiLang
            />
          ),
        },
        {
          id: "summary",
          component: props => (
            <AutoFormTextarea
              {...props}
              description={t("editor.summary.desc")}
              disabled={!canEdit}
              label={t("editor.summary.label")}
              multiLang
            />
          ),
        },
        {
          id: "body",
          component: props => (
            <AutoFormEditor
              {...props}
              className="min-h-96"
              format="json"
              label={t("editor.body.label")}
              multiLang
            />
          ),
        },
        {
          id: "acceptanceLabel",
          hidden: () => !isTerms,
          component: props => (
            <AutoFormInput
              {...props}
              description={t("editor.acceptance_label.desc")}
              disabled={!canEdit}
              label={t("editor.acceptance_label.label")}
              multiLang
            />
          ),
        },
        {
          id: "requiresAcceptance",
          hidden: () => !isTerms,
          component: props => (
            <AutoFormSwitch
              {...props}
              description={
                context.acceptanceForced
                  ? t("editor.requires_acceptance.forced")
                  : t("editor.requires_acceptance.desc")
              }
              disabled={!canEdit || context.acceptanceForced}
              label={t("editor.requires_acceptance.label")}
            />
          ),
        },
        {
          id: "effectiveAt",
          component: props => (
            <AutoFormDateTime
              {...props}
              description={t("editor.effective_at.desc")}
              disabled={!canEdit}
              label={t("editor.effective_at.label")}
            />
          ),
        },
      ]}
      formSchema={formSchema}
      layout={rendered => (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline">
              {t("version", { version: context.nextVersion })}
            </Badge>
            {context.draft?.basedOnVersion ? (
              <Badge variant="secondary">
                {t("editor.based_on", {
                  version: context.draft.basedOnVersion,
                })}
              </Badge>
            ) : null}
            <span className="text-muted-foreground">
              {t("editor.revision", { revision: draft.revision })} ·{" "}
              <time dateTime={draft.updatedAt}>
                {t("draft_updated", { date: formatDate(draft.updatedAt) })}
              </time>
            </span>
          </div>

          <Tabs className="gap-4" defaultValue="edit">
            <TabsList>
              <TabsTrigger value="edit">
                <PencilIcon aria-hidden="true" />
                {t("editor.edit")}
              </TabsTrigger>
              <TabsTrigger value="preview">
                <EyeIcon aria-hidden="true" />
                {t("editor.preview")}
              </TabsTrigger>
              <TabsTrigger value="email">
                <MailIcon aria-hidden="true" />
                {t("editor.email_preview")}
              </TabsTrigger>
            </TabsList>
            <TabsPanels>
              <TabsContent keepMounted value="edit">
                <div className="flex flex-col gap-6">
                  {rendered.title}
                  {rendered.summary}
                  {rendered.body}
                  {rendered.acceptanceLabel}
                  <div className="grid items-start gap-6 md:grid-cols-2">
                    {rendered.requiresAcceptance}
                    {rendered.effectiveAt}
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="preview">
                <DraftPreview
                  documentType={documentType}
                  nextVersion={context.nextVersion}
                />
              </TabsContent>
              <TabsContent value="email">
                <EmailPreview
                  documentType={documentType}
                  revision={draft.revision}
                />
              </TabsContent>
            </TabsPanels>
          </Tabs>

          <ActionBar
            canEdit={canEdit}
            canPublish={canPublish}
            context={context}
            documentType={documentType}
            draft={draft}
            onChanged={onChanged}
          />
        </div>
      )}
      onSubmit={onSubmit}
    />
  );
};

/**
 * The draft of one document type: start one (empty or from a version), edit
 * every language, preview the public page and the email, then publish.
 */
export const LegalDraftEditor = ({
  canEdit,
  canPublish,
  context,
  documentType,
  onChanged,
}: {
  canEdit: boolean;
  canPublish: boolean;
  context: AdminLegalDraftContext;
  documentType: LegalDocumentType;
  onChanged: () => Promise<void>;
}) => {
  const t = useTranslations("admin.system.legal");
  const tError = useTranslations("core.global.errors");
  const [pending, setPending] = React.useState<"blank" | null | number>(null);
  const latest = context.versions[0];

  if (context.draft) {
    return (
      <DraftForm
        canEdit={canEdit}
        canPublish={canPublish}
        context={context}
        documentType={documentType}
        draft={context.draft}
        key={context.draft.revision}
        onChanged={onChanged}
      />
    );
  }

  const start = async (basedOnVersionId: null | number) => {
    setPending(basedOnVersionId ?? "blank");
    try {
      const result = await createAdminLegalDraft(
        documentType,
        basedOnVersionId,
      );
      if (!result.ok) {
        toast.error(tError("title"), {
          description: tError("internal_server_error"),
        });

        return;
      }
      toast.success(t("editor.toast.created.title"), {
        description: t("editor.toast.created.desc"),
      });
      await onChanged();
    } finally {
      setPending(null);
    }
  };

  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FilePlusIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{t("draft_empty.title")}</EmptyTitle>
        <EmptyDescription>{t("draft_empty.desc")}</EmptyDescription>
      </EmptyHeader>
      {canEdit ? (
        <EmptyContent className="flex-row flex-wrap justify-center">
          {latest ? (
            <Button
              disabled={pending !== null}
              isLoading={pending === latest.id}
              onClick={async () => {
                await start(latest.id);
              }}
            >
              <CopyIcon aria-hidden="true" />
              {t("draft_empty.from_version", { version: latest.version })}
            </Button>
          ) : null}
          <Button
            disabled={pending !== null}
            isLoading={pending === "blank"}
            onClick={async () => {
              await start(null);
            }}
            variant={latest ? "outline" : "default"}
          >
            <FilePlusIcon aria-hidden="true" />
            {t("draft_empty.blank")}
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );
};
