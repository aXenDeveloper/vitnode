import type { ContentApprovalState } from "@vitnode/core/content";

import { useQueryClient } from "@tanstack/react-query";
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
  CONTENT_PUBLIC_WRITE_ISSUE_CODES,
  parseContentPublicWriteRejection,
  zodRichTextDocument,
} from "@vitnode/core/content";
import {
  definePluginRoute,
  type PluginRoutePageProps,
} from "@vitnode/core/routing";
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
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

import { manifest } from "@/manifest.gen";

import type { TopicEditSearch } from "./forum-links";
import type { TopicFormValues } from "./topic-form";

import { useForumRejection } from "./forum-errors";
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

const loadEditableTopic = async (param: string) => {
  const id = Number(param);
  if (!Number.isSafeInteger(id) || id < 1) {
    return { state: "notFound" as const };
  }

  const res = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "content/topics",
    path: "/{id}/edit",
    args: { params: { id } },
  });

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

export const route = definePluginRoute<TopicEditData, TopicEditSearch>({
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

const ApprovalNotice = ({
  approval,
  status,
  submitted,
}: {
  approval: ContentApprovalState | null;
  status: EditableTopic["status"];
  submitted: boolean;
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

  if (
    submitted ||
    (status === "draft" &&
      approval?.status === "pending" &&
      approval.kind === "create")
  ) {
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

const TopicEditForm = ({
  record,
  submitted,
}: {
  record: EditableTopic;
  submitted: boolean;
}) => {
  const t = useTranslations("@vitnode/forum.topics");
  const tErrors = useTranslations("@vitnode/forum.forums.errors");
  const rejectTopic = useForumRejection(TOPIC_FORM_FIELDS);
  const queryClient = useQueryClient();
  const versionRef = useRef(record.version);
  const [current, setCurrent] = useState({
    approval: record.approval,
    slug: record.slug,
    status: record.status,
  });
  const [hasConflict, setHasConflict] = useState(false);

  const onSubmit: AutoFormOnSubmit<TopicFormSchema> = async (values, form) => {
    const res = await fetcher({
      plugin: manifest.id,
      method: "patch",
      module: "content/topics",
      path: "/{id}",
      args: {
        params: { id: record.id },
        body: { values, expectedVersion: versionRef.current },
      },
    });

    if (res.status === 200) {
      const updated = await res.json();
      await invalidateForumTopics(queryClient);
      versionRef.current = updated.version;
      setCurrent({
        approval: updated.approval,
        slug: updated.slug,
        status: updated.status,
      });
      setHasConflict(false);
      form.reset(values);

      if (updated.approval?.status === "pending") {
        toast.info(t("edit.pending.title"), {
          description: t("edit.pending.desc"),
        });
      } else {
        toast.success(t("edit.success.title"), {
          description: t("edit.success.desc", { title: values.title }),
        });
      }

      return;
    }

    if (res.status === 409) {
      const conflict = await res.json();

      if (conflict.code === "CONTENT_VERSION_CONFLICT") {
        setHasConflict(true);
      } else {
        setFormFieldError(form, "title", tErrors("unique"));
      }

      return;
    }

    await rejectTopic(res, form);
  };

  return (
    <>
      <ApprovalNotice
        approval={current.approval}
        status={current.status}
        submitted={submitted}
      />

      {hasConflict ? (
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
      ) : null}

      <TopicForm
        defaultValues={formValuesOf(record)}
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
  search,
}: PluginRoutePageProps<TopicEditData, TopicEditSearch>) => {
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
      <TopicEditForm
        key={params.id}
        record={loaderData.record}
        submitted={search.submitted === true}
      />
    </ForumShell>
  );
};

export default TopicEditPage;
