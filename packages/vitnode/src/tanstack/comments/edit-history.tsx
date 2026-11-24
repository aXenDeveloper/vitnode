import type { ContentId } from "@vitnode/api/content/ids";

import { useQuery } from "@tanstack/react-query";
import { zodContentPublicPerson } from "@vitnode/api/content/public-person";
import { cn } from "cn";
import { ChevronDownIcon, HistoryIcon, RotateCwIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";
import { z } from "zod";

import { Avatar } from "@/components/avatar";
import { DateFormat } from "@/components/date-format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { UserFormat } from "@/components/user-format";

import { contentCommentAuthorName } from "./author";
import { useContentCommentsContext } from "./root";

const HISTORY_OPERATIONS = ["create", "update"] as const;

const zodHistory = z.object({
  complete: z.boolean(),
  edits: z.array(
    z.object({
      actor: zodContentPublicPerson.nullable().catch(null),
      createdAt: z.string(),
      id: z.number(),
      operation: z.enum(HISTORY_OPERATIONS).catch("update"),
    }),
  ),
});

const zodHistoryEntry = z.object({
  changes: z.array(
    z.object({
      after: z.string().nullable(),
      before: z.string().nullable(),
      field: z.string(),
    }),
  ),
});

interface DiffLine {
  id: string;
  kind: "added" | "removed" | "same";
  text: string;
}

const SKELETON_ROWS = ["first", "second"];

const linesOf = (text: null | string) =>
  (text ?? "")
    .split("\n")
    .map(line => line.trim())
    .filter(line => line !== "");

const diffLines = (beforeText: null | string, afterText: null | string) => {
  const before = linesOf(beforeText);
  const after = linesOf(afterText);
  const table = Array.from({ length: before.length + 1 }, () =>
    Array<number>(after.length + 1).fill(0),
  );
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      table[i][j] =
        before[i] === after[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && before[i] === after[j]) {
      lines.push({ id: `s${i}-${j}`, kind: "same", text: before[i] });
      i++;
      j++;
    } else if (
      i < before.length &&
      (j === after.length || table[i + 1][j] >= table[i][j + 1])
    ) {
      lines.push({ id: `r${i}`, kind: "removed", text: before[i] });
      i++;
    } else {
      lines.push({ id: `a${j}`, kind: "added", text: after[j] });
      j++;
    }
  }

  return lines;
};

const useCommentHistory = (
  commentId: ContentId,
  editCount: number,
  enabled: boolean,
) => {
  const { comments } = useContentCommentsContext();

  return useQuery({
    enabled: enabled && comments.history !== null,
    queryFn: async () => {
      const res = await comments.history?.list(commentId);
      if (!res?.ok) {
        throw new Error(`History request failed: ${res?.status ?? 0}`);
      }

      return zodHistory.parse(await res.json());
    },
    queryKey: [...comments.queryKey, "history", commentId, editCount],
  });
};

type HistoryEdit = NonNullable<
  ReturnType<typeof useCommentHistory>["data"]
>["edits"][number];

const HistoryLoadError = ({
  copy,
  isRetrying,
  onRetry,
}: {
  copy: "entry_error" | "load_error";
  isRetrying: boolean;
  onRetry: () => void;
}) => {
  const t = useTranslations("core.comments.edits");

  return (
    <Empty className="p-6" role="alert">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HistoryIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{t(`${copy}.title`)}</EmptyTitle>
        <EmptyDescription>{t(`${copy}.desc`)}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button isLoading={isRetrying} onClick={onRetry} variant="outline">
          <RotateCwIcon aria-hidden="true" />
          {t("retry")}
        </Button>
      </EmptyContent>
    </Empty>
  );
};

const EditDiff = ({
  commentId,
  edit,
}: {
  commentId: ContentId;
  edit: HistoryEdit;
}) => {
  const t = useTranslations("core.comments.edits");
  const { comments } = useContentCommentsContext();
  const entry = useQuery({
    queryFn: async () => {
      const res = await comments.history?.entry(commentId, edit.id);
      if (!res?.ok) {
        throw new Error(`Edit request failed: ${res?.status ?? 0}`);
      }

      return zodHistoryEntry.parse(await res.json());
    },
    queryKey: [...comments.queryKey, "history", commentId, "entry", edit.id],
  });

  if (entry.isPending) {
    return (
      <div aria-busy="true" className="flex flex-col gap-2 p-4">
        <span className="sr-only" role="status">
          {t("loading")}
        </span>
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-full" />
      </div>
    );
  }

  if (entry.isError) {
    return (
      <HistoryLoadError
        copy="entry_error"
        isRetrying={entry.isFetching}
        onRetry={() => {
          void entry.refetch();
        }}
      />
    );
  }

  const lines = entry.data.changes.flatMap(change =>
    diffLines(change.before, change.after),
  );
  const changed = lines.some(line => line.kind !== "same");

  return (
    <div className="flex flex-col gap-3 p-4">
      {edit.operation === "update" && !changed ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("formatting_only")}
        </p>
      ) : null}
      <ol className="flex flex-col gap-3">
        {lines.map(line => (
          <li
            className={cn(
              "border-s-4 ps-4 leading-relaxed text-pretty",
              edit.operation === "create" || line.kind === "same"
                ? "border-transparent"
                : line.kind === "added"
                  ? "border-success"
                  : "border-destructive",
              line.kind === "same" &&
                edit.operation === "update" &&
                "text-muted-foreground",
            )}
            key={line.id}
          >
            {edit.operation === "update" && line.kind !== "same" ? (
              <span className="sr-only">
                {t(line.kind === "added" ? "added" : "removed")}:{" "}
              </span>
            ) : null}
            {line.text}
          </li>
        ))}
      </ol>
    </div>
  );
};

const EditDialog = ({
  commentId,
  edit,
  onOpenChange,
}: {
  commentId: ContentId;
  edit: HistoryEdit | null;
  onOpenChange: (open: boolean) => void;
}) => {
  const t = useTranslations("core.comments.edits");
  const tc = useTranslations("core.comments");
  const name =
    (edit?.actor ? contentCommentAuthorName(edit.actor) : null) ??
    tc("deleted_user");

  return (
    <Dialog onOpenChange={onOpenChange} open={edit !== null}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {edit ? (
          <>
            <DialogHeader className="border-b p-4 pe-14">
              <DialogTitle className="text-balance">
                {edit.operation === "create"
                  ? t("dialog.created_title", { name })
                  : t("dialog.edited_title", { name })}
              </DialogTitle>
              <DialogDescription>
                {t.rich(
                  edit.operation === "create"
                    ? "dialog.created_desc"
                    : "dialog.edited_desc",
                  { date: () => <DateFormat date={edit.createdAt} /> },
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-96 overflow-y-auto overscroll-contain">
              <EditDiff commentId={commentId} edit={edit} />
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

const HistoryRow = ({
  edit,
  isLatest,
  onOpen,
}: {
  edit: HistoryEdit;
  isLatest: boolean;
  onOpen: () => void;
}) => {
  const t = useTranslations("core.comments.edits");
  const tc = useTranslations("core.comments");

  return (
    <li>
      <button
        className="hover:bg-muted focus-visible:bg-muted flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-start text-sm transition-colors duration-150 ease-out outline-none"
        onClick={onOpen}
        type="button"
      >
        {edit.actor ? (
          <Avatar
            alt=""
            className="size-6 shrink-0"
            size={24}
            user={edit.actor}
          />
        ) : (
          <span
            aria-hidden="true"
            className="bg-muted size-6 shrink-0 rounded-full"
          />
        )}
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1 gap-y-0.5">
          {t.rich(edit.operation === "create" ? "created" : "edited", {
            date: () => (
              <span className="text-muted-foreground">
                <DateFormat date={edit.createdAt} />
              </span>
            ),
            name: () =>
              edit.actor ? (
                <UserFormat
                  className="font-semibold"
                  format
                  user={edit.actor}
                />
              ) : (
                <span className="font-semibold">{tc("deleted_user")}</span>
              ),
          })}
          {isLatest && edit.operation === "update" ? (
            <span className="text-muted-foreground">{t("most_recent")}</span>
          ) : null}
        </span>
      </button>
    </li>
  );
};

/**
 * The "edited" link next to a comment's date: a popover with who created and
 * who edited the comment, and a dialog with the text before and after each
 * edit. Reads through the thread's `history`; signed-in members only.
 */
export const ContentCommentEditHistory = ({
  commentId,
  editCount,
}: {
  commentId: ContentId;
  editCount: number;
}) => {
  const t = useTranslations("core.comments.edits");
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<HistoryEdit | null>(null);
  const history = useCommentHistory(commentId, editCount, open);

  return (
    <>
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger
          render={
            <button
              aria-label={t("trigger_label", { count: editCount })}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex cursor-pointer items-center gap-0.5 rounded-sm text-xs font-medium transition-colors duration-150 ease-out outline-none focus-visible:ring-3"
              type="button"
            />
          }
        >
          {t("trigger")}
          <ChevronDownIcon aria-hidden="true" className="size-3.5" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 gap-0 p-0 sm:w-96">
          <p className="text-muted-foreground border-b px-4 py-2.5 text-sm">
            {t("title", { count: editCount })}
          </p>
          {history.isPending ? (
            <div aria-busy="true" className="flex flex-col gap-2 p-4">
              <span className="sr-only" role="status">
                {t("loading")}
              </span>
              {SKELETON_ROWS.map(key => (
                <div className="flex items-center gap-3" key={key}>
                  <Skeleton className="size-6 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
          ) : history.isError ? (
            <HistoryLoadError
              copy="load_error"
              isRetrying={history.isFetching}
              onRetry={() => {
                void history.refetch();
              }}
            />
          ) : (
            <>
              <ul className="py-1">
                {history.data.edits.map((edit, index) => (
                  <HistoryRow
                    edit={edit}
                    isLatest={index === 0}
                    key={edit.id}
                    onOpen={() => {
                      setOpen(false);
                      setSelected(edit);
                    }}
                  />
                ))}
              </ul>
              {history.data.complete ? null : (
                <p className="text-muted-foreground border-t px-4 py-2.5 text-xs">
                  {t("incomplete")}
                </p>
              )}
            </>
          )}
        </PopoverContent>
      </Popover>
      <EditDialog
        commentId={commentId}
        edit={selected}
        onOpenChange={open => {
          if (!open) setSelected(null);
        }}
      />
    </>
  );
};
