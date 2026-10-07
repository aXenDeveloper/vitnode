import { useAvailableAiActions } from "@vitnode/core/components/ai/use-available-ai-actions";
import { Badge } from "@vitnode/core/components/ui/badge";
import { Button } from "@vitnode/core/components/ui/button";
import { Spinner } from "@vitnode/core/components/ui/spinner";
import {
  aiErrorCodeOf,
  requestAiAssist,
} from "@vitnode/core/lib/ai/assist-client";
import { SparklesIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { CONFIG_PLUGIN } from "@/const";

export const ARTICLE_REVIEW_ACTION = `${CONFIG_PLUGIN.pluginId}:article.review`;

export interface ArticleReviewSuggestion {
  area: "clarity" | "completeness" | "structure" | "tone";
  message: string;
  priority: "high" | "low";
}

export interface ArticleReview {
  suggestions: ArticleReviewSuggestion[];
  summary: string;
}

const isReview = (value: unknown): value is ArticleReview =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { summary?: unknown }).summary === "string" &&
  Array.isArray((value as { suggestions?: unknown }).suggestions);

/** The review result - suggestions only, presented as such. */
export const ArticleReviewResult = ({ review }: { review: ArticleReview }) => {
  const t = useTranslations("@vitnode/blog.admin.article.editor.review");

  return (
    <div className="flex flex-col gap-2">
      <p className="text-foreground text-sm leading-relaxed text-pretty">
        {review.summary}
      </p>
      {review.suggestions.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("nothing")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {review.suggestions.map(suggestion => (
            <li
              className="flex flex-col gap-1 rounded-md border p-2"
              key={`${suggestion.area}:${suggestion.message}`}
            >
              <div className="flex items-center gap-2">
                <Badge variant="outline">{t(`areas.${suggestion.area}`)}</Badge>
                {suggestion.priority === "high" ? (
                  <Badge variant="secondary">{t("high")}</Badge>
                ) : null}
              </div>
              <p className="text-sm leading-relaxed text-pretty">
                {suggestion.message}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/**
 * Optional AI review before publishing. It sits beside the deterministic
 * checks and never gates them: publishing works the same with or without it.
 */
export const ArticleAiReview = ({
  content,
  excerpt,
  locale,
  title,
}: {
  content: string;
  excerpt: string;
  locale: string;
  title: string;
}) => {
  const t = useTranslations("@vitnode/blog.admin.article.editor.review");
  const tError = useTranslations("core.global.ai_assist.error");
  const { data: available = [] } = useAvailableAiActions("admin");
  const [pending, setPending] = React.useState(false);
  const [review, setReview] = React.useState<ArticleReview | null>(null);
  const [error, setError] = React.useState<null | string>(null);

  if (!available.includes(ARTICLE_REVIEW_ACTION)) return null;

  const run = async () => {
    setPending(true);
    setError(null);
    try {
      const { output } = await requestAiAssist({
        action: ARTICLE_REVIEW_ACTION,
        input: { content, excerpt: excerpt || undefined, locale, title },
      });
      if (isReview(output)) setReview(output);
    } catch (caught) {
      setError(tError(aiErrorCodeOf(caught)));
    } finally {
      setPending(false);
    }
  };

  return (
    <section
      aria-labelledby="article-ai-review"
      className="flex flex-col gap-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold" id="article-ai-review">
          {t("title")}
        </h2>
        <Button
          disabled={pending || !title.trim() || !content.trim()}
          onClick={() => void run()}
          size="xs"
          type="button"
          variant="outline"
        >
          {pending ? <Spinner /> : <SparklesIcon aria-hidden />}
          {review ? t("again") : t("run")}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
        {t("disclaimer")}
      </p>
      <div aria-live="polite">
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        {review ? <ArticleReviewResult review={review} /> : null}
      </div>
    </section>
  );
};
