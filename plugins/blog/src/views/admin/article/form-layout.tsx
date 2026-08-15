"use client";

import {
  ContentFormActions,
  ContentFormField,
  ContentFormLayoutGrid,
  ContentFormMain,
  ContentFormSection,
  ContentFormSidebar,
  ContentFormStatus,
} from "@vitnode/core/content/admin-form";
import { useTranslations } from "next-intl";

export const BlogArticleFormLayout = () => {
  const t = useTranslations("@vitnode/blog.admin.article.form");

  return (
    <ContentFormLayoutGrid>
      <ContentFormMain>
        <ContentFormSection>
          <ContentFormField name="title" />
          <ContentFormField name="friendlyUrl" />
          <ContentFormField name="content" />
        </ContentFormSection>
      </ContentFormMain>

      <ContentFormSidebar>
        <ContentFormSection title={t("publish")}>
          <ContentFormStatus />
          <ContentFormActions className="justify-end" />
        </ContentFormSection>

        <ContentFormSection title={t("settings.title")}>
          <ContentFormField name="categoryId" />
          <ContentFormField name="authorId" />
        </ContentFormSection>
      </ContentFormSidebar>
    </ContentFormLayoutGrid>
  );
};
