import { useMiddlewareConfigQuery } from "@vitnode/core/tanstack/auth";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { ArticleAiError } from "./ai";

export const useArticleAi = () => {
  const t = useTranslations("@vitnode/blog.admin.article.editor.ai");
  const { data } = useMiddlewareConfigQuery();
  const [pending, setPending] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const run = React.useCallback(
    async (key: string, task: () => Promise<void>, title: string) => {
      setPending(current => new Set(current).add(key));
      try {
        await task();
        toast.success(title, { description: t("done") });
      } catch (error) {
        toast.error(title, {
          description: t(
            error instanceof ArticleAiError && error.status === 400
              ? "not_configured"
              : "error",
          ),
        });
      } finally {
        setPending(current => {
          const next = new Set(current);
          next.delete(key);

          return next;
        });
      }
    },
    [t],
  );

  return {
    available: data.ai.models.length > 0,
    isPending: (key: string) => pending.has(key),
    run,
  };
};

export type ArticleAi = ReturnType<typeof useArticleAi>;
