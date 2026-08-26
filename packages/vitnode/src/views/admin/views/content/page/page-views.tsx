import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { z } from "zod";

import type { RegisteredFrontendContentType } from "@/content/admin/config";

import { contentApiFetch } from "@/content/admin/fetch.server";
import { buildContentFormSpec } from "@/content/admin/spec";
import { CONTENT_PERMISSIONS } from "@/content/const";
import { contentAdminHref, contentEditHrefTemplate } from "@/content/registry";
import { checkAdminPermissionApi } from "@/lib/api/get-session-admin-api";
import { resolveContentFormLayout } from "@/lib/plugin";

import { getContentLabels } from "../content-admin-view";
import { ContentFormPage } from "./content-form-page";

/** The row shape a form opens on: the record, plus its reference labels. */
const zodDetail = z
  .object({
    id: z.number(),
    labels: z.record(z.string(), z.string().nullable()),
  })
  .loose();

const fieldOverridesOf = (entry: RegisteredFrontendContentType) =>
  Object.fromEntries(
    Object.entries(entry.registration.fields ?? {}).map(([name, override]) => [
      name,
      override.component,
    ]),
  );

/**
 * The spec a form page needs, and the labels its headings use.
 *
 * Identical to what the list screen builds for its dialogs - page mode changes
 * where the form is, not what the form is.
 */
const buildPageSpecs = async (entry: RegisteredFrontendContentType) => {
  const { definition, pluginId } = entry;
  const labels = await getContentLabels(entry);

  return {
    labels,
    spec: buildContentFormSpec({
      definition,
      labelEnum: labels.labelEnum,
      labelField: labels.labelField,
      labelSection: labels.labelSection,
      pluginId,
    }),
  };
};

/** Every translation of one record, values included, in one request. */
const zodTranslations = z.object({
  edges: z.array(z.object({ locale: z.string() }).loose()),
});

export const ContentCreatePageView = async ({
  entry,
}: {
  entry: RegisteredFrontendContentType;
}) => {
  const { definition, pluginId, registration } = entry;

  const [t, tPage, canView, canCreate] = await Promise.all([
    getTranslations("core.content.create"),
    getTranslations("core.content.page"),
    checkAdminPermissionApi({
      module: definition.permissionModule,
      permission: CONTENT_PERMISSIONS.view,
      plugin: pluginId,
    }),
    checkAdminPermissionApi({
      module: definition.permissionModule,
      permission: CONTENT_PERMISSIONS.create,
      plugin: pluginId,
    }),
  ]);

  if (!canView || !canCreate) notFound();

  const { labels, spec } = await buildPageSpecs(entry);
  const singular = labels.singular;
  const backHref = contentAdminHref(definition);

  return (
    <div className="p-4">
      <ContentFormPage
        backHref={backHref}
        createdHrefTemplate={
          definition.admin.edit.mode === "page"
            ? contentEditHrefTemplate(definition)
            : undefined
        }
        fieldOverrides={fieldOverridesOf(entry)}
        header={{
          back: {
            href: backHref,
            label: tPage("back", { name: labels.plural }),
          },
          desc: t("desc", { name: singular }),
          title: t("title", { name: singular }),
        }}
        layout={resolveContentFormLayout(registration.forms, "create")}
        publication={definition.publication.enabled}
        singular={singular}
        spec={spec}
      />
    </div>
  );
};

export const ContentEditPageView = async ({
  entry,
  itemId,
}: {
  entry: RegisteredFrontendContentType;
  itemId: number;
}) => {
  const { definition, pluginId, registration } = entry;
  const localized = definition.localization.enabled;

  const [t, tPage, locale, canView, canEdit] = await Promise.all([
    getTranslations("core.content.edit"),
    getTranslations("core.content.page"),
    getLocale(),
    checkAdminPermissionApi({
      module: definition.permissionModule,
      permission: CONTENT_PERMISSIONS.view,
      plugin: pluginId,
    }),
    checkAdminPermissionApi({
      module: definition.permissionModule,
      permission: CONTENT_PERMISSIONS.edit,
      plugin: pluginId,
    }),
  ]);

  if (!canView) notFound();
  if (!canEdit) notFound();

  const result = await contentApiFetch({
    definition,
    method: "get",
    path: `/${itemId}`,
    pluginId,
    schema: zodDetail,
  });

  if (result.status !== 200 || !result.data) notFound();

  const translations = localized
    ? await contentApiFetch({
        definition,
        method: "get",
        path: `/${itemId}/translations`,
        pluginId,
        schema: zodTranslations,
      })
    : undefined;

  const { labels, spec } = await buildPageSpecs(entry);
  const backHref = contentAdminHref(definition);
  const singular = labels.singular;
  const data = result.data as Record<string, unknown> & { id: number };
  const titleField = definition.admin.titleField;
  const localizedValues = (
    (translations?.data?.edges ?? []) as {
      locale: string;
      values?: Record<string, unknown>;
    }[]
  ).find(row => row.locale.toLowerCase() === locale.toLowerCase())?.values;
  const rawTitle =
    titleField === null
      ? undefined
      : definition.fields[titleField]?.localized === true
        ? localizedValues?.[titleField]
        : data[titleField];
  const title =
    typeof rawTitle === "string" && rawTitle !== "" ? rawTitle : `#${data.id}`;

  return (
    <div className="p-4">
      <ContentFormPage
        backHref={backHref}
        data={data}
        fieldOverrides={fieldOverridesOf(entry)}
        header={{
          back: {
            href: backHref,
            label: tPage("back", { name: labels.plural }),
          },
          desc: title,
          title: t("title", { name: singular }),
        }}
        layout={resolveContentFormLayout(registration.forms, "edit")}
        publication={definition.publication.enabled}
        singular={singular}
        spec={spec}
        title={title}
        translations={(translations?.data?.edges ?? []) as never}
      />
    </div>
  );
};
