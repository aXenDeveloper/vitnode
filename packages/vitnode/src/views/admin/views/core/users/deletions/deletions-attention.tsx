import { Link } from "@tanstack/react-router";
import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { Badge } from "@/components/ui/badge";
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/ui/frame";

import type { AccountDeletionActionsProps } from "./deletions-actions";
import type { AccountDeletionsSummary } from "./deletions-query";

import { AccountDeletionActions } from "./deletions-actions";

export const deletionRef = (id: number) => `DR-${String(id).padStart(4, "0")}`;

/** Requests that ran out of time - failed, or past their grace period - with their actions. */
export const AccountDeletionsAttention = ({
  canDelete,
  onCancel,
  onErase,
  summary,
}: AccountDeletionActionsProps & {
  canDelete: boolean;
  summary: AccountDeletionsSummary;
}) => {
  const t = useTranslations("admin.user.deletions");

  if (summary.attention.length === 0) return null;

  return (
    <Frame render={<section aria-labelledby="deletions-attention-title" />}>
      <FrameHeader>
        <FrameTitle
          className="flex items-center gap-2"
          id="deletions-attention-title"
          render={<h3 />}
        >
          {t("attention.title")}
          <Badge className="tabular-nums" variant="destructive">
            {summary.attention.length}
          </Badge>
        </FrameTitle>
      </FrameHeader>
      <FramePanel>
        {summary.attention.map(item => (
          <div className="flex flex-col gap-2 px-4 py-3" key={item.id}>
            <div className="flex flex-wrap items-center gap-2">
              {item.user ? (
                <Link
                  className="text-foreground font-medium break-words underline-offset-4 hover:underline"
                  to={`/admin/core/users/${item.user.id}`}
                >
                  {item.user.name}
                </Link>
              ) : (
                <span className="font-medium">{deletionRef(item.id)}</span>
              )}
              <Badge
                variant={item.status === "failed" ? "destructive" : "warning"}
              >
                {t(`status.${item.status}`)}
              </Badge>
              <span className="text-muted-foreground text-sm tabular-nums">
                {deletionRef(item.id)} ·{" "}
                {item.status === "failed" ? (
                  t("attention.attempts", { count: item.attempts })
                ) : (
                  <>
                    {t("attention.due")} <DateFormat date={item.scheduledAt} />
                  </>
                )}
              </span>
            </div>
            {item.lastError ? (
              <p className="text-destructive m-0 text-sm leading-relaxed break-words">
                {item.lastError}
              </p>
            ) : null}
            {canDelete ? (
              <AccountDeletionActions
                deletionId={item.id}
                onCancel={onCancel}
                onErase={onErase}
                status={item.status}
              />
            ) : null}
          </div>
        ))}
      </FramePanel>
    </Frame>
  );
};
