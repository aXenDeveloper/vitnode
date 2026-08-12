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

/**
 * The article editor: a wide writing column and a metadata sidebar.
 *
 * **Presentation only.** Every field here is the one the Content Engine built,
 * complete with its overrides, its validation and its error message; the submit
 * button is the engine's; the mutation, the version precondition, the toast, the
 * cache invalidation, the events, the search write and the delivery effects all
 * happen exactly as they do in the generated dialog. This file decides where
 * things are and nothing else - there is not a single API call in it.
 *
 * One layout for create and edit, and one for every language. The title, the
 * body and the URL are localized and the category and the author are not, and
 * this file cannot tell: a localized field renders its own small language
 * switcher, so `ContentFormField` places all five in one screen without knowing
 * which table any of them is stored on.
 *
 * The publication state is read-only, deliberately and consistently with the
 * generated dialog: `status` and `publishedAt` are not in the form schema, and
 * the publish action on the list is the one thing that moves them. Two mutation
 * paths in one screen is how a form ends up fighting its own state.
 */
export const BlogArticleFormLayout = () => {
  const t = useTranslations("@vitnode/blog.admin.article.form");

  return (
    <ContentFormLayoutGrid>
      <ContentFormMain>
        <ContentFormSection>
          <ContentFormField name="title" />
          <ContentFormField name="content" />
        </ContentFormSection>
      </ContentFormMain>

      <ContentFormSidebar>
        <ContentFormSection title={t("publish")}>
          <ContentFormStatus />
          <ContentFormActions className="justify-end" />
        </ContentFormSection>

        <ContentFormSection title={t("settings.title")}>
          <ContentFormField name="friendlyUrl" />
          <ContentFormField name="categoryId" />
          <ContentFormField name="authorId" />
        </ContentFormSection>
      </ContentFormSidebar>
    </ContentFormLayoutGrid>
  );
};
