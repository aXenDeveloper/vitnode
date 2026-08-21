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

        {/*
          The cover image and its alt text, together and in that order: the file
          is shared and the description of it is per language, and writing the
          second before choosing the first is not how anybody works. The
          uploader's own constraint line - "JPG, PNG, WEBP, AVIF" and "Maximum
          file size: 5 MB" - comes from the field descriptor, so this layout
          neither states nor can contradict it.
        */}
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
  );
};
