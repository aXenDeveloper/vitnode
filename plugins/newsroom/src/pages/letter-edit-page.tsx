import type { AutoFormOnSubmit } from "@vitnode/core/components/form/auto-form";

import { useQueryClient } from "@tanstack/react-query";
import { buttonVariants } from "@vitnode/core/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@vitnode/core/components/ui/empty";
import {
  definePluginRoute,
  type PluginRoutePageProps,
} from "@vitnode/core/routing";
import { useContentPublicWrite } from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { HrefLink } from "@vitnode/core/tanstack/link";
import { LogInIcon, SearchXIcon, ShieldAlertIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { manifest } from "@/manifest.gen";

import {
  LETTER_FIELDS,
  LetterForm,
  type LetterFormSchema,
} from "./letter-form";
import { invalidateLetterLists } from "./letter-list";
import { letterEditHref, letterHref } from "./letter-search";
import { LetterShell } from "./letter-shell";

// Answers only for the owner and moderators, drafts and hidden records included.
const fetchEditableLetter = async (id: number) =>
  await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "content/letters",
    path: "/{id}/edit",
    args: { params: { id } },
  });

const loadEditableLetter = async (param: string) => {
  const id = Number(param);
  if (!Number.isSafeInteger(id) || id < 1) {
    return { state: "notFound" as const };
  }

  const res = await fetchEditableLetter(id);

  if (res.status === 200) {
    return { record: await res.json(), state: "ready" as const };
  }
  if (res.status === 401) return { id, state: "unauthenticated" as const };
  if (res.status === 403) return { state: "forbidden" as const };
  if (res.status === 404) return { state: "notFound" as const };

  throw new Error(`Loading letter ${id} for editing failed.`);
};

type LetterEditData = Awaited<ReturnType<typeof loadEditableLetter>>;

type EditableLetter = Extract<LetterEditData, { state: "ready" }>["record"];

const LetterEditBreadcrumb = () => {
  const t = useTranslations("newsroom.letters.edit");

  return <span>{t("title")}</span>;
};

export const route = definePluginRoute({
  load: async ({ params }) => await loadEditableLetter(params.id),

  head: ({ t }) => ({
    robots: "noindex, nofollow",
    title: t("newsroom.letters.edit.title"),
  }),

  breadcrumb: LetterEditBreadcrumb,
});

const LetterEditForm = ({ record }: { record: EditableLetter }) => {
  const t = useTranslations("newsroom.letters");
  const queryClient = useQueryClient();
  const [slug, setSlug] = useState(record.slug);
  const write = useContentPublicWrite({
    fields: LETTER_FIELDS,
    latestVersion: async () => {
      const res = await fetchEditableLetter(record.id);

      return res.status === 200 ? (await res.json()).version : null;
    },
    uniqueField: "title",
    version: record.version,
  });

  const onSubmit: AutoFormOnSubmit<LetterFormSchema> = async (values, form) => {
    const updated = await write.submit(
      form,
      async expectedVersion =>
        await fetcher({
          plugin: manifest.id,
          method: "patch",
          module: "content/letters",
          path: "/{id}",
          args: {
            params: { id: record.id },
            body: { values, expectedVersion },
          },
        }),
    );
    if (!updated) return;

    setSlug(updated.slug);
    form.reset(values);
    await invalidateLetterLists(queryClient);
    toast.success(t("edit.success.title"), {
      description: t("edit.success.desc", { title: updated.values.title }),
    });
  };

  return (
    <>
      {write.conflict}

      <LetterForm
        defaultValues={record.values}
        onSubmit={onSubmit}
        submitLabel={t("edit.submit")}
      />

      {slug !== null && record.status === "published" && (
        <HrefLink
          className={buttonVariants({
            className: "self-start",
            variant: "link",
          })}
          href={letterHref(slug)}
        >
          {t("edit.view")}
        </HrefLink>
      )}
    </>
  );
};

const RefusedState = ({
  action,
  description,
  icon,
  title,
}: {
  action?: React.ReactNode;
  description: string;
  icon: React.ReactNode;
  title: string;
}) => (
  <div className="container mx-auto flex max-w-3xl px-4 py-8 md:py-12">
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle render={<h1 />}>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  </div>
);

const LetterEditPage = ({
  loaderData,
}: PluginRoutePageProps<LetterEditData>) => {
  const t = useTranslations("newsroom.letters");

  if (loaderData.state === "unauthenticated") {
    return (
      <RefusedState
        action={
          <HrefLink
            className={buttonVariants()}
            href={`/login?returnTo=${encodeURIComponent(letterEditHref(loaderData.id))}`}
          >
            {t("state.unauthenticated.action")}
          </HrefLink>
        }
        description={t("state.unauthenticated.desc")}
        icon={<LogInIcon aria-hidden="true" />}
        title={t("state.unauthenticated.title")}
      />
    );
  }

  if (loaderData.state === "forbidden" || loaderData.state === "notFound") {
    const key = loaderData.state === "forbidden" ? "forbidden" : "not_found";

    return (
      <RefusedState
        action={
          <HrefLink
            className={buttonVariants({ variant: "outline" })}
            href="/letters/new"
          >
            {t("state.back")}
          </HrefLink>
        }
        description={t(`state.${key}.desc`)}
        icon={
          key === "forbidden" ? (
            <ShieldAlertIcon aria-hidden="true" />
          ) : (
            <SearchXIcon aria-hidden="true" />
          )
        }
        title={t(`state.${key}.title`)}
      />
    );
  }

  return (
    <LetterShell description={t("edit.desc")} title={t("edit.title")}>
      <LetterEditForm record={loaderData.record} />
    </LetterShell>
  );
};

export default LetterEditPage;
