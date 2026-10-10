import type { RichTextDocument } from "@vitnode/core/content/rich-text";

import { Link } from "@tanstack/react-router";
import { useEditorConfig } from "@vitnode/core/components/editor-provider";
import { MultiLangLanguageContext } from "@vitnode/core/components/form/fields/multi-lang-language";
import { useLanguages } from "@vitnode/core/components/languages-provider";
import { RichTextContent } from "@vitnode/core/components/rich-text";
import { Button } from "@vitnode/core/components/ui/button";
import {
  ContentFormActions,
  ContentFormField,
  ContentFormStatusSwitch,
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
import { cn } from "cn";
import { ArrowLeftIcon, ListChecksIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import {
  translateArticleContent,
  translateArticleText,
  writeArticleExcerpt,
} from "./ai";
import { ArticleAiReview } from "./ai-review";
import {
  type ArticleFieldActions,
  ArticleFieldActionsContext,
} from "./field-actions";
import { type CheckAction, Previews, ReadinessList } from "./publish-panel";
import {
  type ArticleCheck,
  articleChecks,
  articleContent,
  type ArticleTextField,
  type ArticleValues,
  fieldText,
  REQUIRED_TRANSLATED_FIELDS,
  type TranslatedField,
  translatedFieldStatus,
} from "./readiness";
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
  "excerpt",
  "coverImageAlt",
] as const satisfies readonly TranslatedField[];

export const ArticleEditor = ({
  contentTypeId,
  itemId,
}: {
  contentTypeId: string;
  itemId: number | undefined;
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
  const panelRef = React.useRef<HTMLElement>(null);

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
    // Co-edited, the document goes in through the shared editor - one
    // transaction everyone in the article sees, and can undo.
    if (replaceRichText) {
      replaceRichText("content", locale, document);

      return;
    }
    // Alone, the editor is uncontrolled once it mounts, so a document written
    // from outside it remounts it on the new value.
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

  const writeExcerpt = async (locale: string) => {
    const current = valuesRef.current;
    if (locale !== source && getLangValue(current.excerpt, source).trim()) {
      await translateField("excerpt", locale);

      return;
    }

    await ai.run(
      `excerpt:${locale}`,
      async () => {
        setLangValue(
          "excerpt",
          locale,
          await writeArticleExcerpt({
            content: (fieldText(current, "content", locale)
              ? articleContent(current, locale)
              : articleContent(current, source)) ?? { type: "doc" },
            locale,
            title:
              getLangValue(current.title, locale) ||
              getLangValue(current.title, source),
          }),
        );
      },
      t("ai.write_excerpt"),
    );
  };

  const openLanguage = (code: string) => {
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
      case "excerpt":
        return ai.available
          ? [
              {
                ai: true,
                label: t("publish.checks.write"),
                run: () => {
                  for (const code of check.missing) void writeExcerpt(code);
                },
              },
            ]
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

  // The language on screen is the one this editor works in: the others see
  // them there on the language menu even before a field has focus.
  const focusLanguage = live?.session.focus;
  React.useEffect(() => {
    focusLanguage?.(null, fieldLocale);
  }, [fieldLocale, focusLanguage]);
  const excerptPending = ai.isPending(`excerpt:${fieldLocale}`);
  const fieldActions: ArticleFieldActions = ai.available
    ? {
        excerpt: (
          <AiButton
            label={
              target && getLangValue(values.excerpt, source).trim()
                ? t("translate.field")
                : t("ai.write_excerpt")
            }
            onClick={() => {
              void writeExcerpt(fieldLocale);
            }}
            pending={excerptPending}
            pendingLabel={t("ai.writing")}
          />
        ),
        ...(target && getLangValue(values.coverImageAlt, source).trim()
          ? {
              coverImageAlt: (
                <AiButton
                  label={t("translate.field")}
                  onClick={() => {
                    void translateField("coverImageAlt", target);
                  }}
                  pending={ai.isPending(`coverImageAlt:${target}`)}
                  pendingLabel={t("ai.translating")}
                />
              ),
            }
          : {}),
      }
    : {};

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
    <ArticleFieldActionsContext value={fieldActions}>
      <div className="-m-6 flex min-h-full flex-col">
        <header className="bg-background/95 supports-backdrop-filter:bg-background/80 sticky top-0 z-30 flex min-h-14 flex-wrap items-center gap-2 border-b px-4 py-2 backdrop-blur sm:px-6">
          {header ? (
            <Button
              nativeButton={false}
              render={<Link to={header.back.href} />}
              size="sm"
              variant="ghost"
            >
              <ArrowLeftIcon aria-hidden />
              <span className="hidden sm:inline">{header.back.label}</span>
              <span className="sr-only sm:hidden">{header.back.label}</span>
            </Button>
          ) : null}
          <h1 className="sr-only">{header?.title ?? t("heading")}</h1>
          <div className="flex-1" />
          <ContentLiveStatus className="hidden md:flex" />
          <ContentLivePresence />
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
            aria-label={t("publish.open", {
              done: ready,
              total: checks.length,
            })}
            onClick={() => {
              panelRef.current?.scrollIntoView({ block: "start" });
              panelRef.current?.focus({ preventScroll: true });
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            <ListChecksIcon aria-hidden />
            <span className="tabular-nums">
              {ready}/{checks.length}
            </span>
          </Button>
          <ContentFormStatusSwitch />
          <ContentFormActions withPublicationToggle={false} />
        </header>

        <div
          className={cn(
            "grid grid-cols-1 items-start gap-8 px-4 py-8 sm:px-6 xl:grid-cols-[minmax(0,1fr)_22rem]",
          )}
        >
          <div
            className={cn(
              "mx-auto flex w-full min-w-0 flex-col gap-6",
              !target && "max-w-3xl",
            )}
          >
            {target ? (
              <>
                {outdated.includes(target) && !dismissed.includes(target) ? (
                  <OutdatedBanner
                    action={
                      <>
                        {ai.available &&
                        aiUpdatableFields(target).length > 0 ? (
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

          <aside
            aria-labelledby="article-ready"
            className="flex scroll-mt-20 flex-col gap-8 outline-none xl:sticky xl:top-20 xl:max-h-[calc(100dvh-6rem)] xl:overflow-y-auto xl:pe-1"
            ref={panelRef}
            tabIndex={-1}
          >
            <ReadinessList
              actionsFor={actionsFor}
              checks={checks}
              languageName={languageName}
              sourceName={sourceName}
            />
            <ArticleAiReview
              content={articleContent(values, fieldLocale)}
              excerpt={getLangValue(values.excerpt, fieldLocale)}
              locale={fieldLocale}
              title={getLangValue(values.title, fieldLocale)}
            />
            <Previews
              cover={files?.coverImage}
              languages={languages}
              source={source}
              values={values}
            />
            <section
              aria-labelledby="article-details"
              className="flex flex-col gap-5"
            >
              <h2 className="text-sm font-semibold" id="article-details">
                {t("publish.details")}
              </h2>
              <MultiLangLanguageContext value={fieldLocale}>
                <div className="flex flex-col gap-2">
                  {target && getLangValue(values.excerpt, source).trim() ? (
                    <p
                      className="bg-muted text-muted-foreground rounded-md px-2.5 py-2 text-sm leading-relaxed"
                      lang={source}
                    >
                      {getLangValue(values.excerpt, source)}
                    </p>
                  ) : null}
                  <ContentFormField name="excerpt" />
                </div>
                <div className="flex flex-col gap-2">
                  <ContentFormField name="coverImage" />
                </div>
                <div className="flex flex-col gap-2">
                  {target &&
                  getLangValue(values.coverImageAlt, source).trim() ? (
                    <p
                      className="bg-muted text-muted-foreground rounded-md px-2.5 py-2 text-sm leading-relaxed"
                      lang={source}
                    >
                      {getLangValue(values.coverImageAlt, source)}
                    </p>
                  ) : null}
                  <ContentFormField name="coverImageAlt" />
                </div>
              </MultiLangLanguageContext>
            </section>
          </aside>
        </div>
      </div>
    </ArticleFieldActionsContext>
  );
};
