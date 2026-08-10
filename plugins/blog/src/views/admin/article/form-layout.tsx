"use client";

import type { ContentFormLayoutProps } from "@vitnode/core/lib/plugin";

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
 * One layout for create and edit, and one for both surfaces of a localized
 * content type. `ContentFormField` renders nothing for a field this surface does
 * not have, so the shared tab shows the category and the author while each
 * language tab shows that language's title, body and URL - from the same source.
 *
 * The publication state is read-only, deliberately and consistently with the
 * generated dialog: `status` and `publishedAt` are not in the form schema, and
 * the publish action on the list is the one thing that moves them. Two mutation
 * paths in one screen is how a form ends up fighting its own state.
 */
export const BlogArticleFormLayout = ({ surface }: ContentFormLayoutProps) => {
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

        <ContentFormSection
          desc={
            surface === "translation" ? t("settings.locale_desc") : undefined
          }
          title={t("settings.title")}
        >
          <ContentFormField name="friendlyUrl" />
          <ContentFormField name="categoryId" />
          <ContentFormField name="authorId" />
        </ContentFormSection>
      </ContentFormSidebar>
    </ContentFormLayoutGrid>
  );
};
