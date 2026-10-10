import type { ContentFileFieldValue } from "@vitnode/core/content/files";

import { Button } from "@vitnode/core/components/ui/button";
import { cn } from "cn";
import { SparklesIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { type ArticleCheck, RECOMMENDED_LENGTH } from "./readiness";

export interface CheckAction {
  ai?: boolean;
  label: string;
  run: () => void;
}

export const CheckActions = ({ actions }: { actions: CheckAction[] }) => (
  <div className="-ms-2 flex flex-wrap gap-1">
    {actions.map(action => (
      <Button
        className={cn(action.ai && "text-primary")}
        key={action.label}
        onClick={action.run}
        size="xs"
        type="button"
        variant="ghost"
      >
        {action.ai ? <SparklesIcon /> : null}
        {action.label}
      </Button>
    ))}
  </div>
);

export const useCheckDetail = ({
  languageName,
  sourceName,
}: {
  languageName: (code: string) => string;
  sourceName: string;
}) => {
  const t = useTranslations("@vitnode/blog.admin.article.editor.publish");
  const list = (codes: readonly string[]) => codes.map(languageName).join(", ");

  return (check: ArticleCheck): React.ReactNode => {
    switch (check.id) {
      case "alt":
        return t("checks.alt_detail", { languages: list(check.missing) });
      case "cover":
        return t("checks.cover_detail");
      case "excerpt":
        return t("checks.excerpt_detail", { languages: list(check.missing) });
      case "outdated":
        return t("checks.outdated_detail", {
          languages: list(check.outdated),
          source: sourceName,
        });
      case "title":
        return t("checks.title_detail", {
          languages: list(check.tooLong),
          max: RECOMMENDED_LENGTH.title,
        });
      case "translations":
        return (
          <span className="flex flex-col">
            {Object.entries(check.missing).map(([code, count]) => (
              <span key={code}>
                {t("checks.translations_detail", {
                  count,
                  language: languageName(code),
                })}
              </span>
            ))}
          </span>
        );
    }
  };
};

export const coverUrlOf = (
  value: unknown,
  file: ContentFileFieldValue | undefined,
): null | string => {
  if (!file || Array.isArray(file)) return null;

  return file.id === value ? file.url : null;
};
