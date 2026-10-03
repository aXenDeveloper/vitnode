import { cn } from "cn";
import { EyeOffIcon, SendIcon } from "lucide-react";
import React from "react";
import { useFormatter, useTranslations } from "use-intl";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { isContentPublished } from "@/content/publication";

import { useContentForm } from "./context";
import { ContentFormButtonSkeleton } from "./skeleton";

type StatusOption = "draft" | "published";

const OPTIONS: StatusOption[] = ["draft", "published"];

export const ContentFormStatusSwitch = ({
  className,
}: {
  className?: string;
}) => {
  const t = useTranslations("core.content.status");
  const tContent = useTranslations("core.content");
  const format = useFormatter();
  const { mode, publication, singular, skeleton, title } = useContentForm();
  const [pending, setPending] = React.useState<null | StatusOption>(null);
  const buttonsRef = React.useRef<(HTMLButtonElement | null)[]>([]);

  if (!publication.enabled || mode === "create") return null;
  if (skeleton) return <ContentFormButtonSkeleton />;

  const current: StatusOption = isContentPublished(publication.status)
    ? "published"
    : "draft";
  const { transition } = publication;
  const disabled = !publication.canPublish || !transition;
  const action = pending === "published" ? "publish" : "unpublish";
  const publishedAt =
    typeof publication.publishedAt === "string"
      ? new Date(publication.publishedAt)
      : null;

  const choose = (option: StatusOption) => {
    if (option !== current && !disabled) setPending(option);
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const step = { ArrowDown: 1, ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1 }[
      event.key
    ];
    if (!step) return;
    event.preventDefault();
    const next = (index + step + OPTIONS.length) % OPTIONS.length;
    buttonsRef.current[next]?.focus();
  };

  return (
    <>
      <TooltipWithContent
        text={
          publishedAt
            ? t("published_on", {
                date: format.dateTime(publishedAt, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }),
              })
            : t("never_published")
        }
      >
        <div
          aria-label={t("label")}
          className={cn(
            "bg-muted inline-flex h-9 items-center gap-0.5 rounded-lg p-0.5",
            className,
          )}
          role="radiogroup"
        >
          {OPTIONS.map((option, index) => {
            const checked = option === current;

            return (
              <button
                aria-checked={checked}
                aria-disabled={disabled && !checked ? true : undefined}
                className={cn(
                  "text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-[color,background-color,box-shadow] duration-150 ease-out outline-none focus-visible:ring-3 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 motion-reduce:transition-none",
                  checked && "bg-card text-foreground shadow-xs",
                )}
                key={option}
                onClick={() => {
                  choose(option);
                }}
                onKeyDown={event => {
                  onKeyDown(event, index);
                }}
                ref={element => {
                  buttonsRef.current[index] = element;
                }}
                role="radio"
                tabIndex={checked ? 0 : -1}
                type="button"
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-1.5 rounded-full",
                    option === "published" ? "bg-success" : "bg-warn",
                  )}
                />
                {t(option)}
              </button>
            );
          })}
        </div>
      </TooltipWithContent>

      <ConfirmActionAlertDialog
        description={tContent.rich(`${action}.desc`, {
          title: () => (
            <span className="text-foreground font-bold">
              {title ?? singular}
            </span>
          ),
        })}
        icon={action === "publish" ? <SendIcon /> : <EyeOffIcon />}
        onOpenChange={open => {
          if (!open) setPending(null);
        }}
        onSubmit={async ({ onClose }) => {
          if (transition && (await transition(action))) onClose();
        }}
        open={pending !== null}
        submitVariant={action === "publish" ? "default" : "destructive"}
        textSubmit={tContent(`${action}.confirm`)}
        title={tContent(`${action}.title`, { name: singular })}
      />
    </>
  );
};
