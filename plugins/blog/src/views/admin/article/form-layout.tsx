import type { ContentFormLayoutProps } from "@vitnode/core/lib/plugin";

import { Skeleton } from "@vitnode/core/components/ui/skeleton";
import { useContentForm } from "@vitnode/core/content/admin-form";
import React from "react";

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
  <div className="flex flex-col gap-2">
    <Skeleton className={label} />
    <Skeleton className={control} />
  </div>
);

const ArticleEditorSkeleton = () => {
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
      <div className="flex min-h-14 flex-wrap items-center gap-2 border-b px-4 py-2 sm:px-6">
        <Skeleton className="h-8 w-9 sm:w-36" />
        <div className="flex-1" />
        <div className="flex items-center gap-2 max-sm:order-last max-sm:-mx-4 max-sm:grow max-sm:basis-full max-sm:border-t max-sm:px-4 max-sm:pt-2">
          <Skeleton className="h-8 w-9 sm:w-28" />
          <Skeleton className="h-8 w-14 sm:w-20" />
          <Skeleton className="h-8 w-9 sm:w-28" />
          {creating ? null : <Skeleton className="h-9 w-44 max-sm:ms-auto" />}
        </div>
        {creating ? (
          <>
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-28" />
          </>
        ) : (
          <Skeleton className="h-9 w-36" />
        )}
      </div>

      <div className="px-4 py-8 sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-4">
            {creating ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-36 w-full rounded-xl" />
              </div>
            ) : (
              <Skeleton className="aspect-2/1 w-full rounded-xl" />
            )}
            <FieldSkeleton control="h-9 w-full" label="h-4 w-36" />
          </div>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-9 w-3/4 sm:h-10" />
            <Skeleton className="h-5 w-40" />
          </div>
          <div className="grid grid-cols-1 gap-4 border-y py-4 md:grid-cols-2">
            <FieldSkeleton control="h-11 w-full" label="h-4 w-24" />
            <FieldSkeleton control="h-11 w-full" label="h-4 w-20" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-16" />
            <div className="flex flex-col rounded-lg border">
              <div className="flex items-center gap-2 border-b p-2">
                <Skeleton className="h-7 w-28" />
                <Skeleton className="h-7 w-48" />
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
