import type { ContentId } from "@vitnode/core/content";
import type { RichTextDocument } from "@vitnode/core/content/rich-text";

import { Link } from "@tanstack/react-router";
import { useEditorConfig } from "@vitnode/core/components/editor-provider";
import { AutoFormFileDisplayContext } from "@vitnode/core/components/form/fields/file-display";
import { MultiLangLanguageContext } from "@vitnode/core/components/form/fields/multi-lang-language";
import { useLanguages } from "@vitnode/core/components/languages-provider";
import { RichTextContent } from "@vitnode/core/components/rich-text";
import { Badge } from "@vitnode/core/components/ui/badge";
import { Button } from "@vitnode/core/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@vitnode/core/components/ui/sheet";
import { TooltipWithContent } from "@vitnode/core/components/ui/tooltip";
import {
  ContentFormField,
  ContentFormHiddenNotice,
  ContentFormPublicationLabel,
  ContentFormSaveMenu,
  ContentLivePresence,
  ContentLiveStatus,
  useContentForm,
  useContentFormValues,
  useContentLive,
  useContentRichTextReplace,
  useSetContentFormValue,
  useTranslationFreshness,
} from "@vitnode/core/content/admin-form";
import { slugify } from "@vitnode/core/content/slug";
import {
  getLangValue,
  upsertLangValue,
} from "@vitnode/core/lib/helpers/multi-lang";
import { ContentAccessEffectiveNotice } from "@vitnode/core/views/admin/views/access/effective-notice";
import { cn } from "cn";
import { ArrowLeftIcon, SearchIcon, SparklesIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { blogPostContentType } from "@/content/post";
import { manifest } from "@/manifest.gen";

import type { CheckAction } from "./readiness-actions";

import { translateArticleContent, translateArticleText } from "./ai";
import { ArticleAiReview, useArticleReviewAvailable } from "./ai-review";
import {
  type ArticleCheck,
  articleChecks,
  articleContent,
  type ArticleTextField,
  type ArticleValues,
  REQUIRED_TRANSLATED_FIELDS,
  type TranslatedField,
  translatedFieldStatus,
} from "./readiness";
import { SeoAudit } from "./seo-audit";
import {
  ActiveTranslation,
  AiButton,
  OutdatedBanner,
  PairRow,
  TranslateMenu,
} from "./translate";
import { useArticleAi } from "./use-article-ai";

const AI_TRANSLATED_FIELDS = [
  "title",
  "content",
  "coverImageAlt",
] as const satisfies readonly TranslatedField[];

export const ArticleEditor = ({
  contentTypeId,
  itemId,
}: {
  contentTypeId: string;
  itemId: ContentId | undefined;
}) => {
  const t = useTranslations("@vitnode/blog.admin.article.editor");
  const { defaultLocale, files, header, markHeaderRendered } = useContentForm();
  const languages = useLanguages();
  const source = defaultLocale ?? languages[0]?.code ?? "en";
  const locales = languages.map(language => language.code);
  const values = useContentFormValues() as ArticleValues;
  const valuesRef = React.useRef(values);
  React.useEffect(() => {
    valuesRef.current = values;
  });
  const setFormValue = useSetContentFormValue();
  const live = useContentLive();
  const replaceRichText = useContentRichTextReplace();
  const { emojis } = useEditorConfig();
  const ai = useArticleAi();
  const [target, setTarget] = React.useState<null | string>(null);
  const [contentRevision, setContentRevision] = React.useState(0);
  const [dismissed, setDismissed] = React.useState<string[]>([]);
  const [sheet, setSheet] = React.useState<"review" | "seo" | null>(null);
  const reviewAvailable = useArticleReviewAvailable();

  markHeaderRendered?.();

  const languageName = (code: string) =>
    languages.find(language => language.code === code)?.name ?? code;
  const sourceName = languageName(source);
  const freshness = useTranslationFreshness({
    contentTypeId,
    fields: AI_TRANSLATED_FIELDS,
    itemId,
    source,
    values,
  });
  const outdated = locales.filter(
    code => code !== source && freshness.outdatedFields(code).length > 0,
  );
  const checks = articleChecks({ locales, outdated, source, values });
  const ready = checks.filter(check => check.ok).length;

  const setLangValue = (
    field: ArticleTextField,
    locale: string,
    text: string,
  ) => {
    setFormValue(
      field,
      upsertLangValue(valuesRef.current[field], locale, text),
    );
  };

  const setContent = (locale: string, document: RichTextDocument) => {
    setFormValue(
      "content",
      upsertLangValue<null | RichTextDocument>(
        valuesRef.current.content,
        locale,
        document,
      ),
    );
    if (replaceRichText) {
      replaceRichText("content", locale, document);

      return;
    }
    setContentRevision(revision => revision + 1);
  };

  const statusOf = (field: TranslatedField, locale: string) =>
    translatedFieldStatus(values, field, { source, target: locale });

  const translateField = async (field: TranslatedField, to: string) => {
    if (field === "friendlyUrl") {
      const title =
        getLangValue(valuesRef.current.title, to) ||
        getLangValue(valuesRef.current.title, source);
      setLangValue("friendlyUrl", to, slugify(title));

      return;
    }

    await ai.run(
      `${field}:${to}`,
      async () => {
        if (field === "content") {
          const document = articleContent(valuesRef.current, source);
          if (!document) return;

          setContent(
            to,
            await translateArticleContent({
              customEmojis: emojis,
              document,
              from: source,
              to,
            }),
          );

          return;
        }

        setLangValue(
          field,
          to,
          await translateArticleText({
            from: source,
            text: getLangValue(valuesRef.current[field], source),
            to,
          }),
        );
        freshness.rememberAiTranslation(to, field);
      },
      t("translate.active", { language: languageName(to) }),
    );
  };

  const translateFields = async (to: string, fields: TranslatedField[]) => {
    await Promise.all(
      fields
        .filter(field => field !== "friendlyUrl")
        .map(async field => {
          await translateField(field, to);
        }),
    );
    if (fields.includes("friendlyUrl")) await translateField("friendlyUrl", to);
  };

  const aiUpdatableFields = (to: string) =>
    freshness
      .outdatedFields(to)
      .filter(field => !freshness.editedByPerson(to, field));

  const missingFields = (to: string) =>
    [...AI_TRANSLATED_FIELDS, "friendlyUrl" as const].filter(
      field => statusOf(field, to) === "missing",
    );

  const openLanguage = (code: string) => {
    setSheet(null);
    setTarget(code);
    window.scrollTo({ top: 0 });
  };

  const actionsFor = (check: ArticleCheck): CheckAction[] => {
    switch (check.id) {
      case "alt":
        return ai.available
          ? check.missing
              .filter(code => code !== source)
              .map(code => ({
                ai: true,
                label: t("translate.field_into", {
                  language: languageName(code),
                }),
                run: () => {
                  void translateField("coverImageAlt", code);
                },
              }))
          : [];
      case "outdated":
        return check.outdated.map(code => ({
          label: t("publish.checks.open", { language: languageName(code) }),
          run: () => {
            openLanguage(code);
          },
        }));
      case "translations":
        return Object.keys(check.missing).map(code => ({
          label: t("publish.checks.open", { language: languageName(code) }),
          run: () => {
            openLanguage(code);
          },
        }));
      default:
        return [];
    }
  };

  const fieldLocale = target ?? source;
  const unready =
    checks.length -
    ready +
    (getLangValue(values.friendlyUrl, fieldLocale).trim() ? 0 : 1);

  const editAlt = () => {
    setSheet(null);
    window.setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>(
        'input[name="coverImageAlt"]',
      );
      input?.scrollIntoView({ behavior: "smooth", block: "center" });
      input?.focus({ preventScroll: true });
    }, 350);
  };

  const focusLanguage = live?.session.focus;
  React.useEffect(() => {
    focusLanguage?.(null, fieldLocale);
  }, [fieldLocale, focusLanguage]);

  const fieldAction = (field: TranslatedField, to: string) => {
    if (field !== "friendlyUrl" && !ai.available) return null;
    if (statusOf(field, to) === "unavailable") return null;

    return (
      <AiButton
        label={
          field === "friendlyUrl"
            ? t("translate.slug")
            : statusOf(field, to) === "done"
              ? t("translate.field_again")
              : t("translate.field")
        }
        onClick={() => {
          void translateField(field, to);
        }}
        pending={ai.isPending(`${field}:${to}`)}
        pendingLabel={t("ai.translating")}
      />
    );
  };

  const translationLanguages = languages
    .filter(language => language.code !== source)
    .map(language => ({
      code: language.code,
      missing: REQUIRED_TRANSLATED_FIELDS.filter(
        field => statusOf(field, language.code) === "missing",
      ).length,
      name: language.name,
      outdated: outdated.includes(language.code),
    }));

  const sharedFields = (
    <div className="grid grid-cols-1 gap-4 border-y py-4 md:grid-cols-2">
      <div className="flex flex-col gap-2">
        <ContentFormField name="categoryId" />
        <ContentAccessEffectiveNotice
          permissionModule={blogPostContentType.permissionModule}
          pluginId={manifest.id}
          scopeIds={
            Array.isArray(values.categoryId)
              ? (values.categoryId as (number | string)[])
              : []
          }
        />
      </div>
      <div className="flex flex-col gap-2">
        <ContentFormField name="authorId" />
      </div>
    </div>
  );

  const contentField = (
    <React.Fragment key={`${fieldLocale}-${contentRevision}`}>
      <ContentFormField name="content" />
    </React.Fragment>
  );

  return (
    <div className="-m-6 flex min-h-full flex-col">
      <header className="bg-background/95 supports-backdrop-filter:bg-background/80 sticky top-0 z-30 flex min-h-14 flex-wrap items-center gap-1 border-b px-2 py-2 backdrop-blur sm:px-4">
        {header ? (
          <TooltipWithContent text={header.back.label}>
            <Button
              className="w-8 px-0"
              nativeButton={false}
              render={<Link to={header.back.href} />}
              size="sm"
              variant="ghost"
            >
              <ArrowLeftIcon aria-hidden />
              <span className="sr-only">{header.back.label}</span>
            </Button>
          </TooltipWithContent>
        ) : null}
        <h1 className="sr-only">{header?.title ?? t("heading")}</h1>
        {translationLanguages.length > 0 ? (
          target ? (
            <ActiveTranslation
              onExit={() => {
                setTarget(null);
              }}
              sourceName={sourceName}
              targetName={languageName(target)}
            />
          ) : (
            <TranslateMenu
              languages={translationLanguages}
              onPick={openLanguage}
              sourceName={sourceName}
            />
          )
        ) : null}
        <Button
          aria-label={
            unready > 0
              ? t("seo.open_issues", { count: unready })
              : t("seo.open")
          }
          onClick={() => {
            setSheet("seo");
          }}
          size="sm"
          type="button"
          variant="ghost"
        >
          <SearchIcon aria-hidden />
          <span className="max-sm:sr-only">{t("seo.open")}</span>
          {unready > 0 ? <Badge variant="warning">{unready}</Badge> : null}
        </Button>
        {reviewAvailable ? (
          <Button
            aria-label={t("review.open")}
            onClick={() => {
              setSheet("review");
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            <SparklesIcon aria-hidden />
            <span className="max-sm:sr-only">{t("review.open")}</span>
          </Button>
        ) : null}
        <div className="ms-auto flex items-center gap-2">
          <ContentFormPublicationLabel className="me-2" />
          <ContentLiveStatus />
          <ContentLivePresence className="max-lg:hidden" max={3} />
          <ContentFormSaveMenu />
        </div>
      </header>

      <div className="px-4 py-8 sm:px-6">
        <div
          className={cn(
            "mx-auto flex w-full min-w-0 flex-col gap-6",
            !target && "max-w-3xl",
          )}
        >
          <ContentFormHiddenNotice />
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
            <div className="flex flex-col gap-2">
              <AutoFormFileDisplayContext value="cover">
                <ContentFormField name="coverImage" />
              </AutoFormFileDisplayContext>
            </div>
            {target ? null : (
              <MultiLangLanguageContext value={source}>
                <div className="flex flex-col gap-2">
                  <ContentFormField name="coverImageAlt" />
                </div>
              </MultiLangLanguageContext>
            )}
          </div>
          {target ? (
            <>
              {outdated.includes(target) && !dismissed.includes(target) ? (
                <OutdatedBanner
                  action={
                    <>
                      {ai.available && aiUpdatableFields(target).length > 0 ? (
                        <AiButton
                          label={t("translate.update_changed")}
                          onClick={() => {
                            void translateFields(
                              target,
                              aiUpdatableFields(target),
                            );
                          }}
                          pending={AI_TRANSLATED_FIELDS.some(field =>
                            ai.isPending(`${field}:${target}`),
                          )}
                          pendingLabel={t("ai.translating")}
                        />
                      ) : null}
                      <Button
                        onClick={() => {
                          freshness.markReviewed(
                            target,
                            freshness.outdatedFields(target),
                          );
                          setDismissed(current => [...current, target]);
                        }}
                        size="xs"
                        type="button"
                        variant="ghost"
                      >
                        {t("translate.mark_reviewed")}
                      </Button>
                    </>
                  }
                  fields={freshness
                    .outdatedFields(target)
                    .map(field => t(`translate.fields.${field}`))}
                  onDismiss={() => {
                    setDismissed(current => [...current, target]);
                  }}
                  sourceName={sourceName}
                />
              ) : null}

              {ai.available && missingFields(target).length > 0 ? (
                <div className="flex justify-end">
                  <AiButton
                    label={t("translate.missing_fields")}
                    onClick={() => {
                      void translateFields(target, missingFields(target));
                    }}
                    pending={AI_TRANSLATED_FIELDS.some(field =>
                      ai.isPending(`${field}:${target}`),
                    )}
                    pendingLabel={t("ai.translating")}
                  />
                </div>
              ) : null}

              <MultiLangLanguageContext value={target}>
                <PairRow
                  action={fieldAction("coverImageAlt", target)}
                  source={
                    <p className="pt-7 text-sm leading-relaxed" lang={source}>
                      {getLangValue(values.coverImageAlt, source) ||
                        t("translate.empty_source", { language: sourceName })}
                    </p>
                  }
                  sourceName={sourceName}
                  status={statusOf("coverImageAlt", target)}
                  targetName={languageName(target)}
                >
                  <ContentFormField name="coverImageAlt" />
                </PairRow>
                <PairRow
                  action={fieldAction("title", target)}
                  source={
                    <p
                      className="text-2xl leading-tight font-bold tracking-tight text-balance"
                      lang={source}
                    >
                      {getLangValue(values.title, source) ||
                        t("translate.empty_source", { language: sourceName })}
                    </p>
                  }
                  sourceName={sourceName}
                  status={statusOf("title", target)}
                  targetName={languageName(target)}
                >
                  <ContentFormField name="title" />
                </PairRow>
                <PairRow
                  action={fieldAction("friendlyUrl", target)}
                  source={
                    <p className="truncate text-sm" lang={source}>
                      /blog/{getLangValue(values.friendlyUrl, source)}
                    </p>
                  }
                  sourceName={sourceName}
                  status={statusOf("friendlyUrl", target)}
                  targetName={languageName(target)}
                >
                  <ContentFormField name="friendlyUrl" />
                </PairRow>
              </MultiLangLanguageContext>

              {sharedFields}

              <MultiLangLanguageContext value={target}>
                <PairRow
                  action={fieldAction("content", target)}
                  source={
                    <div className="pt-16" lang={source}>
                      <RichTextContent
                        content={articleContent(values, source)}
                      />
                    </div>
                  }
                  sourceName={sourceName}
                  status={statusOf("content", target)}
                  targetName={languageName(target)}
                >
                  {contentField}
                </PairRow>
              </MultiLangLanguageContext>
            </>
          ) : (
            <MultiLangLanguageContext value={source}>
              <div className="flex flex-col gap-2">
                <ContentFormField name="title" />
                <ContentFormField name="friendlyUrl" />
              </div>
              {sharedFields}
              {contentField}
            </MultiLangLanguageContext>
          )}
        </div>
      </div>

      <Sheet
        onOpenChange={open => {
          if (!open) setSheet(null);
        }}
        open={sheet === "seo"}
      >
        <SheetContent className="w-full sm:max-w-md" keepMounted>
          <SheetHeader>
            <SheetTitle>{t("seo.title")}</SheetTitle>
            <SheetDescription>{t("seo.desc")}</SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto px-4 pb-6">
            <SeoAudit
              actionsFor={actionsFor}
              checks={checks}
              cover={files?.coverImage}
              languageName={languageName}
              locale={fieldLocale}
              onEditAlt={editAlt}
              sourceName={sourceName}
              values={values}
            />
          </div>
        </SheetContent>
      </Sheet>

      {reviewAvailable ? (
        <Sheet
          onOpenChange={open => {
            if (!open) setSheet(null);
          }}
          open={sheet === "review"}
        >
          <SheetContent className="w-full sm:max-w-md" keepMounted>
            <SheetHeader>
              <SheetTitle>{t("review.title")}</SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto px-4 pb-6">
              <ArticleAiReview
                content={articleContent(values, fieldLocale)}
                locale={fieldLocale}
                onContentChange={next => {
                  setContent(fieldLocale, next);
                }}
                title={getLangValue(values.title, fieldLocale)}
              />
            </div>
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
};
