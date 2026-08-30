"use client";

import type { ContentFormLayoutProps } from "@vitnode/core/lib/plugin";

import {
  ContentFormActions,
  ContentFormField,
  ContentFormHeader,
  ContentFormLayoutGrid,
  ContentFormMain,
  ContentFormSection,
  ContentFormSidebar,
  ContentFormStatus,
} from "@vitnode/core/content/admin-form";
import { useTranslations } from "use-intl";

export const BlogArticleFormLayout = ({ mode }: ContentFormLayoutProps) => {
  const t = useTranslations("@vitnode/blog.admin.article.form");

  return (
    <>
      <ContentFormHeader>
        <ContentFormActions />
      </ContentFormHeader>

      <ContentFormLayoutGrid>
        <ContentFormMain>
          <ContentFormSection>
            <ContentFormField name="title" />
            <ContentFormField name="friendlyUrl" />
            <ContentFormField name="content" />
          </ContentFormSection>
        </ContentFormMain>

        <ContentFormSidebar>
          {mode === "edit" ? (
            <ContentFormSection title={t("publish")}>
              <ContentFormStatus />
            </ContentFormSection>
          ) : null}

          <ContentFormSection title={t("cover.title")}>
            <ContentFormField name="coverImage" />
            <ContentFormField name="coverImageAlt" />
          </ContentFormSection>

          <ContentFormSection title={t("settings.title")}>
            <ContentFormField name="categoryId" />
            <ContentFormField name="authorId" />
          </ContentFormSection>
        </ContentFormSidebar>
      </ContentFormLayoutGrid>
    </>
  );
};
