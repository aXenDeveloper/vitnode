import type { RichTextDocument } from "@vitnode/core/content/rich-text";

import { useAvailableAiActions } from "@vitnode/core/components/ai/use-available-ai-actions";
import { Badge } from "@vitnode/core/components/ui/badge";
import { Button } from "@vitnode/core/components/ui/button";
import { Spinner } from "@vitnode/core/components/ui/spinner";
import { isRichTextEmpty } from "@vitnode/core/content/rich-text";
import {
  aiErrorCodeOf,
  requestAiAssist,
} from "@vitnode/core/lib/ai/assist-client";
import { cn } from "cn";
import { CheckIcon, SparklesIcon, WandSparklesIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { CONFIG_PLUGIN } from "@/const";

import { applyPassageFix, type PassageFix } from "./passage-fix";

const ARTICLE_REVIEW_ACTION = `${CONFIG_PLUGIN.pluginId}:article.review`;

interface ArticleReviewSuggestion {
  area: "clarity" | "completeness" | "structure" | "tone";
  fix?: null | PassageFix;
  message: string;
  priority: "high" | "low";
}

interface ArticleReview {
  suggestions: ArticleReviewSuggestion[];
  summary: string;
}

type SuggestionState = "applied" | "dismissed" | "idle" | "open";

export const useArticleReviewAvailable = () => {
  const { data: available = [] } = useAvailableAiActions("admin");

  return available.includes(ARTICLE_REVIEW_ACTION);
};

const isReview = (value: unknown): value is ArticleReview =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { summary?: unknown }).summary === "string" &&
  Array.isArray((value as { suggestions?: unknown }).suggestions);

const FixPreview = ({ fix }: { fix: PassageFix }) => {
  const t = useTranslations("@vitnode/blog.admin.article.editor.review.fix");

  return (
    <div className="flex flex-col gap-1.5 text-sm leading-relaxed">
      <p className="bg-destructive/10 rounded-md px-2.5 py-1.5 text-pretty line-through decoration-1">
        <span className="sr-only">{t("before")}: </span>
        {fix.quote}
      </p>
      {fix.replacement ? (
        <p className="bg-success/10 rounded-md px-2.5 py-1.5 text-pretty">
          <span className="sr-only">{t("after")}: </span>
          {fix.replacement}
        </p>
      ) : (
        <p className="text-muted-foreground px-2.5 text-xs">{t("removes")}</p>
      )}
    </div>
  );
};

const SuggestionCard = ({
  content,
  onApply,
  suggestion,
}: {
  content: null | RichTextDocument;
  onApply: (document: RichTextDocument) => void;
  suggestion: ArticleReviewSuggestion;
}) => {
  const t = useTranslations("@vitnode/blog.admin.article.editor.review");
  const [state, setState] = React.useState<SuggestionState>("idle");
  const fix = suggestion.fix ?? null;
  const fixed = fix ? applyPassageFix(content, fix) : null;

  if (state === "applied" || state === "dismissed") {
    return (
      <li className="text-muted-foreground flex items-center gap-2 py-1 text-sm">
        <CheckIcon
          aria-hidden
          className={cn(
            "size-4 shrink-0",
            state === "applied" && "text-success",
          )}
        />
        <span className="min-w-0 flex-1 truncate">
          {t(`fix.${state}`)}: {suggestion.message}
        </span>
        {state === "dismissed" ? (
          <Button
            onClick={() => {
              setState("idle");
            }}
            size="xs"
            type="button"
            variant="ghost"
          >
            {t("fix.undo")}
          </Button>
        ) : null}
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg p-3 ring-1 ring-black/8 dark:ring-white/10">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">
          {t(`areas.${suggestion.area}`)}
        </span>
        {suggestion.priority === "high" ? (
          <Badge variant="warning">{t("high")}</Badge>
        ) : null}
      </div>
      <p className="text-sm leading-relaxed text-pretty">
        {suggestion.message}
      </p>
      {state === "open" && fix ? (
        <>
          <FixPreview fix={fix} />
          {fixed ? null : (
            <p className="text-warn text-xs leading-relaxed text-pretty">
              {t("fix.stale")}
            </p>
          )}
        </>
      ) : null}
      <div className="-ms-2 flex flex-wrap gap-1">
        {fix && state === "open" && fixed ? (
          <Button
            className="ms-2"
            onClick={() => {
              onApply(fixed);
              setState("applied");
            }}
            size="xs"
            type="button"
          >
            <CheckIcon aria-hidden />
            {t("fix.apply")}
          </Button>
        ) : null}
        {fix && state === "idle" ? (
          <Button
            className="text-primary"
            onClick={() => {
              setState("open");
            }}
            size="xs"
            type="button"
            variant="ghost"
          >
            <WandSparklesIcon aria-hidden />
            {t("fix.show")}
          </Button>
        ) : null}
        <Button
          onClick={() => {
            setState("dismissed");
          }}
          size="xs"
          type="button"
          variant="ghost"
        >
          {t("fix.dismiss")}
        </Button>
      </div>
    </li>
  );
};

export const ArticleAiReview = ({
  content,
  excerpt,
  locale,
  onContentChange,
  title,
}: {
  content: null | RichTextDocument;
  excerpt: string;
  locale: string;
  onContentChange: (document: RichTextDocument) => void;
  title: string;
}) => {
  const t = useTranslations("@vitnode/blog.admin.article.editor.review");
  const tError = useTranslations("core.global.ai_assist.error");
  const [pending, setPending] = React.useState(false);
  const [review, setReview] = React.useState<ArticleReview | null>(null);
  const [runId, setRunId] = React.useState(0);
  const [error, setError] = React.useState<null | string>(null);

  const run = async () => {
    setPending(true);
    setError(null);
    try {
      const { output } = await requestAiAssist({
        action: ARTICLE_REVIEW_ACTION,
        input: { content, excerpt: excerpt || undefined, locale, title },
      });
      if (isReview(output)) {
        setReview(output);
        setRunId(current => current + 1);
      }
    } catch (caught) {
      setError(tError(aiErrorCodeOf(caught)));
    } finally {
      setPending(false);
    }
  };

  const runButton = (
    <Button
      className="self-start"
      disabled={pending || !title.trim() || isRichTextEmpty(content)}
      onClick={() => void run()}
      size="sm"
      type="button"
      variant="outline"
    >
      {pending ? <Spinner /> : <SparklesIcon aria-hidden />}
      {review ? t("again") : t("run")}
    </Button>
  );
  const high = review?.suggestions.filter(
    item => item.priority === "high",
  ).length;

  return (
    <div aria-live="polite" className="flex flex-col gap-5">
      {review ? (
        <div className="bg-muted/60 flex flex-col gap-1.5 rounded-xl p-4">
          <p className="text-base font-semibold text-balance">
            {review.suggestions.length === 0
              ? t("nothing")
              : t("verdict", {
                  high: high ?? 0,
                  low: review.suggestions.length - (high ?? 0),
                })}
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {review.summary}
          </p>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {t("intro")}
        </p>
      )}
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {review && review.suggestions.length > 0 ? (
        <ul className="flex flex-col gap-3" key={runId}>
          {review.suggestions.map(suggestion => (
            <SuggestionCard
              content={content}
              key={`${suggestion.area}:${suggestion.message}`}
              onApply={onContentChange}
              suggestion={suggestion}
            />
          ))}
        </ul>
      ) : null}
      {runButton}
    </div>
  );
};
