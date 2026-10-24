import type { AutoFormOnSubmit } from "@vitnode/core/components/form/auto-form";
import type { ContentApprovalState } from "@vitnode/core/content";

import { useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@vitnode/core/components/ui/alert";
import { buttonVariants } from "@vitnode/core/components/ui/button";
import {
  CONTENT_PUBLIC_WRITE_ISSUE_CODES,
  parseContentPublicWriteRejection,
  zodRichTextDocument,
} from "@vitnode/core/content";
import {
  definePluginRoute,
  type PluginRoutePageProps,
} from "@vitnode/core/routing";
import { useContentPublicWrite } from "@vitnode/core/tanstack/content";
import { fetcher } from "@vitnode/core/tanstack/fetcher";
import { HrefLink } from "@vitnode/core/tanstack/link";
import {
  ClockIcon,
  HourglassIcon,
  LogInIcon,
  SearchXIcon,
  ShieldAlertIcon,
  XCircleIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import { manifest } from "@/manifest.gen";

import type { TopicFormValues } from "./topic-form";

import {
  FORUM_HREF,
  FORUM_PENDING_HREF,
  loginHref,
  topicEditHref,
  topicHref,
} from "./forum-links";
import { invalidateForumTopics } from "./forum-queries";
import { ForumShell, RefusedState } from "./forum-ui";
import {
  TOPIC_FORM_FIELDS,
  TopicForm,
  type TopicFormSchema,
} from "./topic-form";

const zodProposedValues = z
  .object({
    body: zodRichTextDocument.optional(),
    title: z.string().optional(),
  })
  .catch({});

// Answers only for the author and moderators, drafts and hidden topics included.
const fetchEditableTopic = async (id: number) =>
  await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "content/topics",
    path: "/{id}/edit",
    args: { params: { id } },
  });

const loadEditableTopic = async (param: string) => {
  const id = Number(param);
  if (!Number.isSafeInteger(id) || id < 1) {
    return { state: "notFound" as const };
  }

  const res = await fetchEditableTopic(id);

  if (res.status === 200) {
    return { record: await res.json(), state: "ready" as const };
  }
  if (res.status === 401) return { id, state: "unauthenticated" as const };
  if (res.status === 403) {
    const rejection = parseContentPublicWriteRejection(
      await res.json().catch(() => null),
    );
    const windowClosed = rejection?.issues.some(
      issue => issue.code === CONTENT_PUBLIC_WRITE_ISSUE_CODES.editWindowClosed,
    );

    return {
      state: windowClosed ? ("windowClosed" as const) : ("forbidden" as const),
    };
  }
  if (res.status === 404) return { state: "notFound" as const };

  throw new Error(`Loading topic ${id} for editing failed.`);
};

type TopicEditData = Awaited<ReturnType<typeof loadEditableTopic>>;

type EditableTopic = Extract<TopicEditData, { state: "ready" }>["record"];

const TopicEditBreadcrumb = () => {
  const t = useTranslations("@vitnode/forum.topics.edit");

  return <span>{t("title")}</span>;
};

export const route = definePluginRoute<TopicEditData>({
  load: async ({ params }) => await loadEditableTopic(params.id),

  head: ({ t }) => ({
    description: t("@vitnode/forum.topics.edit.desc"),
    robots: "noindex, nofollow",
    title: t("@vitnode/forum.topics.edit.title"),
  }),

  breadcrumb: TopicEditBreadcrumb,
});

const formValuesOf = (record: EditableTopic): TopicFormValues => {
  const { approval } = record;
  const proposed =
    approval?.status === "pending" && approval.kind === "edit"
      ? zodProposedValues.parse(approval.values ?? {})
      : {};

  return {
    body: proposed.body ?? record.values.body,
    title: proposed.title ?? record.values.title,
  };
};

/** Reads only the server's `approval`: neither the URL nor a draft status adds a notice. */
const ApprovalNotice = ({
  approval,
}: {
  /** Only what the notice reads, so the edit route's JSON answer fits as is. */
  approval: null | Pick<ContentApprovalState, "kind" | "reason" | "status">;
}) => {
  const t = useTranslations("@vitnode/forum.topics.approval");

  if (approval?.status === "rejected") {
    return (
      <Alert icon={<XCircleIcon />} variant="destructive">
        <AlertTitle>{t("rejected.title")}</AlertTitle>
        <AlertDescription>
          {approval.reason
            ? t("rejected.reason", { reason: approval.reason })
            : t("rejected.desc")}
        </AlertDescription>
      </Alert>
    );
  }

  if (approval?.status === "pending" && approval.kind === "edit") {
    return (
      <Alert icon={<HourglassIcon />} variant="info">
        <AlertTitle>{t("pending_edit.title")}</AlertTitle>
        <AlertDescription>{t("pending_edit.desc")}</AlertDescription>
      </Alert>
    );
  }

  if (approval?.status === "pending" && approval.kind === "create") {
    return (
      <Alert icon={<HourglassIcon />} variant="info">
        <AlertTitle>{t("pending_create.title")}</AlertTitle>
        <AlertDescription>
          {t("pending_create.desc")}{" "}
          <HrefLink className="font-medium underline" href={FORUM_PENDING_HREF}>
            {t("pending_create.link")}
          </HrefLink>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};

const TopicEditForm = ({ record }: { record: EditableTopic }) => {
  const t = useTranslations("@vitnode/forum.topics");
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState({
    approval: record.approval,
    slug: record.slug,
    status: record.status,
  });
  // The form's defaults follow every save: AutoForm resets an untouched form
  // to whatever `defaultValues` it renders with.
  const [defaults, setDefaults] = useState(() => formValuesOf(record));
  const write = useContentPublicWrite({
    fields: TOPIC_FORM_FIELDS,
    latestVersion: async () => {
      const res = await fetchEditableTopic(record.id);

      return res.status === 200 ? (await res.json()).version : null;
    },
    uniqueField: "title",
    version: record.version,
  });

  const onSubmit: AutoFormOnSubmit<TopicFormSchema> = async (values, form) => {
    const updated = await write.submit(
      form,
      async expectedVersion =>
        await fetcher({
          plugin: manifest.id,
          method: "patch",
          module: "content/topics",
          path: "/{id}",
          args: {
            params: { id: record.id },
            body: { values, expectedVersion },
          },
        }),
    );
    if (!updated) return;

    setCurrent({
      approval: updated.approval,
      slug: updated.slug,
      status: updated.status,
    });
    setDefaults(values);
    form.reset(values);
    await invalidateForumTopics(queryClient);

    if (updated.approval?.status === "pending") {
      toast.info(t("edit.pending.title"), {
        description: t("edit.pending.desc"),
      });
    } else {
      toast.success(t("edit.success.title"), {
        description: t("edit.success.desc", { title: values.title }),
      });
    }
  };

  return (
    <>
      <ApprovalNotice approval={current.approval} />

      {write.conflict}

      <TopicForm
        defaultValues={defaults}
        onSubmit={onSubmit}
        submitLabel={t("edit.submit")}
      />

      {current.slug !== null && current.status === "published" ? (
        <HrefLink
          className={buttonVariants({
            className: "self-start",
            variant: "link",
          })}
          href={topicHref(current.slug)}
        >
          {t("edit.view")}
        </HrefLink>
      ) : null}
    </>
  );
};

const TopicEditPage = ({
  loaderData,
  params,
}: PluginRoutePageProps<TopicEditData>) => {
  const t = useTranslations("@vitnode/forum.topics");

  if (loaderData.state === "unauthenticated") {
    return (
      <RefusedState
        action={
          <HrefLink
            className={buttonVariants()}
            href={loginHref(topicEditHref(loaderData.id))}
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

  if (loaderData.state !== "ready") {
    const key =
      loaderData.state === "forbidden"
        ? "forbidden"
        : loaderData.state === "windowClosed"
          ? "window_closed"
          : "not_found";

    return (
      <RefusedState
        action={
          <HrefLink
            className={buttonVariants({ variant: "outline" })}
            href={FORUM_HREF}
          >
            {t("state.back")}
          </HrefLink>
        }
        description={t(`state.${key}.desc`)}
        icon={
          key === "forbidden" ? (
            <ShieldAlertIcon aria-hidden="true" />
          ) : key === "window_closed" ? (
            <ClockIcon aria-hidden="true" />
          ) : (
            <SearchXIcon aria-hidden="true" />
          )
        }
        title={t(`state.${key}.title`)}
      />
    );
  }

  return (
    <ForumShell description={t("edit.desc")} title={t("edit.title")}>
      <TopicEditForm key={params.id} record={loaderData.record} />
    </ForumShell>
  );
};

export default TopicEditPage;
