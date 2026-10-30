import { useSuspenseQuery } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { IntlProvider, useMessages, useTranslations } from "use-intl";

import type { ContentId } from "@/content/ids";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { deepMerge } from "@/lib/i18n/deep-merge";
import { IntlProvider as CoreIntlProvider } from "@/lib/i18n/provider";

import type { ContentCommentNode } from "./thread";
import type { ContentCommentsController } from "./use-content-comments";

import { useLocale } from "../i18n/locale";
import { intlQueryOptions } from "../i18n/query";
import { getIntlRuntime } from "../i18n/runtime";
import { ReportDialog } from "../moderation/report-button";
import { WarnDialog } from "../moderation/warn-button";
import { contentCommentAuthor } from "./author";

/** The message namespaces the shared comments components render with. */
export const CONTENT_COMMENTS_NAMESPACES = [
  "core.global",
  "core.comments",
] as const;

interface ContentCommentsContextValue {
  comments: ContentCommentsController;
  /** Opens the delete confirmation for one comment. */
  requestDelete: (node: ContentCommentNode<unknown>) => void;
  /** Opens the report dialog for one comment. */
  requestReport: (node: ContentCommentNode<unknown>) => void;
  /** Opens the warn dialog for one comment's author. */
  requestWarn: (node: ContentCommentNode<unknown>) => void;
}

/**
 * Adds the comment messages to the ones the page already provides, so a
 * plugin's own layout inside a comments root keeps its translations.
 */
const CommentsMessages = ({ children }: { children: React.ReactNode }) => {
  const locale = useLocale();
  const pageMessages = useMessages();
  const { data } = useSuspenseQuery(
    intlQueryOptions({ locale, namespaces: CONTENT_COMMENTS_NAMESPACES }),
  );
  const { hostIntlProvider, timeZone } = getIntlRuntime();
  const messages = React.useMemo(
    () => deepMerge(pageMessages, data.messages),
    [data.messages, pageMessages],
  );
  const intlProps = { locale, messages, timeZone };

  const provided = (
    <IntlProvider {...intlProps}>
      <CoreIntlProvider {...intlProps}>{children}</CoreIntlProvider>
    </IntlProvider>
  );

  if (!hostIntlProvider) return provided;

  return React.createElement(hostIntlProvider, {
    ...intlProps,
    // oxlint-disable-next-line @eslint-react/jsx-no-children-prop
    children: provided,
  });
};

const ContentCommentsContext =
  React.createContext<ContentCommentsContextValue | null>(null);

/**
 * The thread `ContentCommentsRoot` provides, for components that render one
 * of its comments. Throws outside a root.
 */
export const useContentCommentsContext = (): ContentCommentsContextValue => {
  const value = React.use(ContentCommentsContext);
  if (!value) {
    throw new Error(
      "Render shared comment components inside <ContentCommentsRoot> or <ContentComments>.",
    );
  }

  return value;
};

/**
 * Turns an action's failed status into one translated toast. `409` means
 * another action on the thread was still running.
 */
export const useContentCommentErrorToast = () => {
  const t = useTranslations("core.comments.errors");

  return (status: number) => {
    const description =
      status === 401
        ? t("unauthenticated")
        : status === 403
          ? t("forbidden")
          : status === 404
            ? t("not_found")
            : status === 409
              ? t("busy")
              : t("unknown");
    toast.error(t("title"), { description });
  };
};

const RootDialogs = ({
  deleting,
  onDeleteClosed,
  onReportClosed,
  onWarnClosed,
  reporting,
  warning,
}: {
  deleting: ContentCommentNode<unknown> | null;
  onDeleteClosed: () => void;
  onReportClosed: () => void;
  onWarnClosed: () => void;
  reporting: ContentCommentNode<unknown> | null;
  warning: ContentCommentNode<unknown> | null;
}) => {
  const t = useTranslations("core.comments");
  const { comments } = useContentCommentsContext();
  const showError = useContentCommentErrorToast();
  const target = reporting ? comments.reportTarget(reporting.id) : null;
  const warnTarget = warning ? comments.reportTarget(warning.id) : null;
  const warnAuthor = warning ? contentCommentAuthor(warning.record) : null;

  return (
    <>
      <ConfirmActionAlertDialog
        description={t("delete.desc")}
        icon={<Trash2Icon />}
        onOpenChange={open => {
          if (!open) onDeleteClosed();
        }}
        onSubmit={async ({ onClose }) => {
          if (!deleting) return;
          const result = await comments.remove(deleting.id);
          if (!result.ok) {
            showError(result.status);

            return;
          }

          toast.success(t("delete.done.title"), {
            description: t("delete.done.desc"),
          });
          onClose();
        }}
        open={deleting !== null}
        textSubmit={
          <>
            <Trash2Icon aria-hidden="true" />
            {t("delete.confirm")}
          </>
        }
        title={t("delete.title")}
      />

      {target ? (
        <ReportDialog
          onOpenChange={open => {
            if (!open) onReportClosed();
          }}
          open
          target={target}
          typeLabel={t("report_type")}
        />
      ) : null}

      {warnTarget && warnAuthor ? (
        <WarnDialog
          content={warnTarget}
          onOpenChange={open => {
            if (!open) onWarnClosed();
          }}
          open
          userId={warnAuthor.id}
        />
      ) : null}
    </>
  );
};

/**
 * Provides one comment thread to the shared comment components below it and
 * renders the dialogs they open: the delete confirmation, the report
 * dialog and the warn dialog. Adds its own messages to the page's, so it works on any page and
 * your components inside keep their translations. Use it to lay out
 * comments your own way; `ContentComments` renders a complete section with
 * it.
 *
 * @example
 * ```tsx
 * import {
 *   ContentCommentActions,
 *   ContentCommentsRoot,
 * } from "@vitnode/core/tanstack/comments";
 *
 * <ContentCommentsRoot comments={comments}>
 *   {comments.tree.map(node => (
 *     <MyComment key={node.id} node={node}>
 *       <ContentCommentActions node={node} />
 *     </MyComment>
 *   ))}
 * </ContentCommentsRoot>;
 * ```
 */
export const ContentCommentsRoot = <TRecord, TId extends ContentId>({
  children,
  comments,
  fallback = null,
}: {
  children: React.ReactNode;
  comments: ContentCommentsController<TRecord, TId>;
  /** Shown while the comment messages load, the first time on a page. */
  fallback?: React.ReactNode;
}) => {
  const [deleting, setDeleting] =
    React.useState<ContentCommentNode<unknown> | null>(null);
  const [reporting, setReporting] =
    React.useState<ContentCommentNode<unknown> | null>(null);
  const [warning, setWarning] =
    React.useState<ContentCommentNode<unknown> | null>(null);

  const value = React.useMemo<ContentCommentsContextValue>(
    () => ({
      // The components below read records as `unknown` and ids as given.
      comments: comments as unknown as ContentCommentsController,
      requestDelete: setDeleting,
      requestReport: setReporting,
      requestWarn: setWarning,
    }),
    [comments],
  );

  return (
    <React.Suspense fallback={fallback}>
      <CommentsMessages>
        <ContentCommentsContext value={value}>
          {children}
          <RootDialogs
            deleting={deleting}
            onDeleteClosed={() => {
              setDeleting(null);
            }}
            onReportClosed={() => {
              setReporting(null);
            }}
            onWarnClosed={() => {
              setWarning(null);
            }}
            reporting={reporting}
            warning={warning}
          />
        </ContentCommentsContext>
      </CommentsMessages>
    </React.Suspense>
  );
};
