import { ArrowLeftIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { z } from "zod";

import type { RegisteredFrontendContentType } from "@/content/admin/config";

import { Button } from "@/components/ui/button";
import { HeaderContent } from "@/components/ui/header-content";
import { contentApiFetch } from "@/content/admin/fetch.server";
import { buildContentFormSpec } from "@/content/admin/spec";
import { CONTENT_PERMISSIONS } from "@/content/const";
import { contentAdminHref, contentEditHrefTemplate } from "@/content/registry";
import { checkAdminPermissionApi } from "@/lib/api/get-session-admin-api";
import { Link } from "@/lib/navigation";
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
      pluginId,
    }),
  };
};

/** Every translation of one record, values included, in one request. */
const zodTranslations = z.object({
  edges: z.array(z.object({ locale: z.string() }).loose()),
});

/**
 * The generated **create page**.
 *
 * Reachable only with `can_view` *and* `can_create`, checked here rather than
 * inferred from whether a button was rendered - a URL typed into the address bar
 * has to answer the same way the button would have. The generated `POST` checks
 * again, which is the check that actually stops the write.
 */
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

  const { spec } = await buildPageSpecs(entry);
  const singular = definition.admin.label.singular;
  const backHref = contentAdminHref(definition.id);

  return (
    <div className="p-4">
      <HeaderContent
        desc={t("desc", { name: singular })}
        h1={t("title", { name: singular })}
      >
        <Button
          nativeButton={false}
          render={<Link href={backHref} />}
          variant="outline"
        >
          <ArrowLeftIcon />
          {tPage("back", { name: definition.admin.label.plural })}
        </Button>
      </HeaderContent>

      <ContentFormPage
        backHref={backHref}
        // A create hands over to the record's own edit page when there is one,
        // so the author lands where its history and its languages are.
        createdHrefTemplate={
          definition.admin.edit.mode === "page"
            ? contentEditHrefTemplate(definition.id)
            : undefined
        }
        fieldOverrides={fieldOverridesOf(entry)}
        layout={resolveContentFormLayout(registration.forms, "create")}
        publication={definition.publication.enabled}
        singular={singular}
        spec={spec}
      />
    </div>
  );
};

/**
 * The generated **edit page**.
 *
 * Reachable with `can_edit`, localized or not: one form writes the shared fields
 * and every language of the record, and there is no separate permission for the
 * half of it that lives on the translation table.
 *
 * A record that does not exist is a 404, and so is one whose content type the
 * session may not view: the read goes through the generated API, which enforces
 * `can_view` itself, so a missing permission and a missing row are the same
 * answer from here.
 */
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
    // The language this person reads VitNode in, which is the language the
    // heading and every localized input open in.
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

  // Every language of this record, in one request, before the form is rendered:
  // its localized inputs each hold every language at once, and a form that had
  // to fetch them after mounting would fight react-hook-form for the defaults.
  const translations = localized
    ? await contentApiFetch({
        definition,
        method: "get",
        path: `/${itemId}/translations`,
        pluginId,
        schema: zodTranslations,
      })
    : undefined;

  const { spec } = await buildPageSpecs(entry);
  const backHref = contentAdminHref(definition.id);
  const singular = definition.admin.label.singular;
  const data = result.data as Record<string, unknown> & { id: number };
  const titleField = definition.admin.titleField;
  const localizedValues = (
    (translations?.data?.edges ?? []) as {
      locale: string;
      values?: Record<string, unknown>;
    }[]
  ).find(row => row.locale.toLowerCase() === locale.toLowerCase())?.values;
  // The heading reads in the language this person is already using, exactly as
  // the list's rows do - a localized title has no single value to print.
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
      <HeaderContent desc={title} h1={t("title", { name: singular })}>
        <Button
          nativeButton={false}
          render={<Link href={backHref} />}
          variant="outline"
        >
          <ArrowLeftIcon />
          {tPage("back", { name: definition.admin.label.plural })}
        </Button>
      </HeaderContent>

      <ContentFormPage
        backHref={backHref}
        data={data}
        fieldOverrides={fieldOverridesOf(entry)}
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
