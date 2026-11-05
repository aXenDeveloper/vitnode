import type { ContentFormLayoutProps } from "@vitnode/core/lib/plugin";

import { Skeleton } from "@vitnode/core/components/ui/skeleton";
import { useContentForm } from "@vitnode/core/content/admin-form";
import React from "react";
import { useTranslations } from "use-intl";

const loadArticleEditor = async () => await import("./editor/article-editor");

const ArticleEditor = React.lazy(async () =>
  loadArticleEditor().then(module => ({ default: module.ArticleEditor })),
);

const FieldSkeleton = ({
  label,
  control,
}: {
  control: string;
  label: string;
}) => (
  <div className="flex flex-col gap-3">
    <Skeleton className={label} />
    <Skeleton className={control} />
  </div>
);

const ArticleEditorSkeleton = () => {
  const t = useTranslations("core.global");
  const { fieldNames, markHeaderRendered, markRendered, mode, skeleton } =
    useContentForm();
  const creating = mode === "create";

  markHeaderRendered?.();
  if (!skeleton) for (const name of fieldNames) markRendered?.(name);

  React.useEffect(() => {
    void loadArticleEditor();
  }, []);

  return (
    <div aria-busy="true" className="-m-6 flex min-h-full flex-col">
      <span className="sr-only" role="status">
        {t("loading")}
      </span>
      <div className="flex min-h-14 flex-wrap items-center gap-1 border-b px-2 py-2 sm:px-4">
        <Skeleton className="size-8" />
        <Skeleton className="h-8 w-9 sm:w-26" />
        <Skeleton className="h-8 w-16 sm:w-25" />
        <Skeleton className="h-8 w-9 sm:w-26" />
        {creating ? null : <Skeleton className="h-8 w-9 2xl:w-32" />}
        <div className="ms-auto flex items-center gap-2">
          {creating ? (
            <>
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-9 w-24" />
            </>
          ) : (
            <>
              <Skeleton className="h-8 w-9 2xl:w-32" />
              <Skeleton className="me-2 h-5 w-20" />
              <Skeleton className="h-9 w-18 sm:w-44" />
            </>
          )}
        </div>
      </div>

      <div className="px-4 py-8 sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-6">
          <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="flex min-w-0 flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-12 w-3/4" />
                <Skeleton className="h-4 w-12 self-end" />
                <Skeleton className="h-6 w-40" />
              </div>
              <div className="flex flex-col gap-2">
                <FieldSkeleton control="h-9 w-full" label="h-4 w-24" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-8 w-24" />
                </div>
              </div>
              <FieldSkeleton control="h-9 w-full" label="h-4 w-20" />
            </div>
            <div className="flex min-w-0 flex-col gap-3 max-md:order-first">
              {creating ? (
                <div className="flex flex-col gap-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-36 w-full rounded-xl" />
                </div>
              ) : (
                <Skeleton className="aspect-2/1 w-full rounded-xl" />
              )}
              <div className="flex flex-col gap-3">
                <FieldSkeleton control="h-9 w-full" label="h-4 w-36" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3 border-t pt-6">
            <Skeleton className="h-4 w-16" />
            <div className="flex flex-col rounded-lg border">
              <div className="flex items-center gap-2 border-b p-1">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-8 w-48 max-sm:flex-1" />
              </div>
              <div className="flex min-h-96 flex-col gap-3 p-5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const BlogArticleFormLayout = ({
  contentTypeId,
  itemId,
}: ContentFormLayoutProps) => {
  const { skeleton } = useContentForm();

  if (skeleton) return <ArticleEditorSkeleton />;

  return (
    <React.Suspense fallback={<ArticleEditorSkeleton />}>
      <ArticleEditor contentTypeId={contentTypeId} itemId={itemId} />
    </React.Suspense>
  );
};
