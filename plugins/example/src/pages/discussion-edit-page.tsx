import {
  type AutoFormOnSubmit,
  setFormFieldError,
} from "@vitnode/core/components/form/auto-form";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@vitnode/core/components/ui/alert";
import { Button, buttonVariants } from "@vitnode/core/components/ui/button";
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
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { HrefLink } from "@vitnode/core/tanstack/link";
import { LogInIcon, SearchXIcon, ShieldAlertIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { CONFIG_PLUGIN } from "@/const";

import {
  DiscussionForm,
  type DiscussionFormSchema,
  useDiscussionRejection,
} from "./discussion-form";
import { discussionEditHref, discussionHref } from "./discussion-search";
import { DiscussionShell } from "./discussion-shell";

const loadEditableDiscussion = async (param: string) => {
  const id = Number(param);
  if (!Number.isSafeInteger(id) || id < 1) {
    return { state: "notFound" as const };
  }

  const res = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
    method: "get",
    module: "content/discussions",
    path: "/{id}/edit",
    args: { params: { id } },
  });

  if (res.status === 200) {
    return { record: await res.json(), state: "ready" as const };
  }
  if (res.status === 401) return { id, state: "unauthenticated" as const };
  if (res.status === 403) return { state: "forbidden" as const };
  if (res.status === 404) return { state: "notFound" as const };

  throw new Error(`Loading discussion ${id} for editing failed.`);
};

type DiscussionEditData = Awaited<ReturnType<typeof loadEditableDiscussion>>;

type EditableDiscussion = Extract<
  DiscussionEditData,
  { state: "ready" }
>["record"];

const DiscussionEditBreadcrumb = () => {
  const t = useTranslations("@vitnode/example.discussions.edit");

  return <span>{t("title")}</span>;
};

export const route = definePluginRoute({
  load: async ({ params }) => await loadEditableDiscussion(params.id),

  head: ({ t }) => ({
    robots: "noindex, nofollow",
    title: t("@vitnode/example.discussions.edit.title"),
  }),

  breadcrumb: DiscussionEditBreadcrumb,
});

const DiscussionEditForm = ({ record }: { record: EditableDiscussion }) => {
  const t = useTranslations("@vitnode/example.discussions");
  const rejectDiscussion = useDiscussionRejection();
  const versionRef = useRef(record.version);
  const [slug, setSlug] = useState(record.slug);
  const [hasConflict, setHasConflict] = useState(false);

  const onSubmit: AutoFormOnSubmit<DiscussionFormSchema> = async (
    values,
    form,
  ) => {
    const res = await fetcher({
      plugin: CONFIG_PLUGIN.pluginId,
      method: "patch",
      module: "content/discussions",
      path: "/{id}",
      args: {
        params: { id: record.id },
        body: { values, expectedVersion: versionRef.current },
      },
    });

    if (res.status === 200) {
      const updated = await res.json();
      versionRef.current = updated.version;
      setSlug(updated.slug);
      setHasConflict(false);
      form.reset(values);

      toast.success(t("edit.success.title"), {
        description: t("edit.success.desc", { title: updated.values.title }),
      });

      return;
    }

    if (res.status === 409) {
      const conflict = await res.json();

      if (conflict.code === "CONTENT_VERSION_CONFLICT") {
        setHasConflict(true);
      } else {
        setFormFieldError(form, "title", t("errors.unique"));
      }

      return;
    }

    await rejectDiscussion(res, form);
  };

  return (
    <>
      {hasConflict && (
        <Alert variant="warning">
          <AlertTitle>{t("edit.conflict.title")}</AlertTitle>
          <AlertDescription>{t("edit.conflict.desc")}</AlertDescription>
          <div className="flex pt-2">
            <Button
              onClick={() => {
                window.location.reload();
              }}
              size="sm"
              variant="outline"
            >
              {t("edit.conflict.reload")}
            </Button>
          </div>
        </Alert>
      )}

      <DiscussionForm
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
          href={discussionHref(slug)}
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

const DiscussionEditPage = ({
  loaderData,
}: PluginRoutePageProps<DiscussionEditData>) => {
  const t = useTranslations("@vitnode/example.discussions");

  if (loaderData.state === "unauthenticated") {
    return (
      <RefusedState
        action={
          <HrefLink
            className={buttonVariants()}
            href={`/login?returnTo=${encodeURIComponent(discussionEditHref(loaderData.id))}`}
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
            href="/discussions/new"
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
    <DiscussionShell description={t("edit.desc")} title={t("edit.title")}>
      <DiscussionEditForm record={loaderData.record} />
    </DiscussionShell>
  );
};

export default DiscussionEditPage;
