import type { ContentFormLayoutProps } from "@vitnode/core/lib/plugin";

import { Skeleton } from "@vitnode/core/components/ui/skeleton";
import {
  ContentFormField,
  useContentForm,
} from "@vitnode/core/content/admin-form";
import React from "react";

const ArticleEditor = React.lazy(async () =>
  import("./editor/article-editor").then(module => ({
    default: module.ArticleEditor,
  })),
);

const ArticleEditorSkeleton = () => {
  const { markHeaderRendered } = useContentForm();

  markHeaderRendered?.();

  return (
    <div aria-busy="true" className="-m-6 flex flex-col">
      <div className="flex h-14 items-center gap-2 border-b px-4 sm:px-6">
        <Skeleton className="h-8 w-24" />
        <div className="flex-1" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid grid-cols-1 items-start gap-8 px-4 py-8 sm:px-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <ContentFormField name="title" />
          <ContentFormField name="friendlyUrl" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ContentFormField name="categoryId" />
            <ContentFormField name="authorId" />
          </div>
          <ContentFormField name="content" />
        </div>
        <div className="flex flex-col gap-6">
          <ContentFormField name="excerpt" />
          <ContentFormField name="coverImage" />
          <ContentFormField name="coverImageAlt" />
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
