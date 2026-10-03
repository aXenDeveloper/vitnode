import { Button } from "@vitnode/core/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@vitnode/core/components/ui/dropdown-menu";
import { cn } from "cn";
import {
  ArrowRightIcon,
  LanguagesIcon,
  LoaderCircleIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { useTranslations } from "use-intl";

import type { FieldStatus } from "./readiness";

export interface TranslationLanguage {
  code: string;
  missing: number;
  name: string;
  outdated: boolean;
}

const StatusDot = ({ status }: { status: "done" | "missing" | "outdated" }) => (
  <span
    aria-hidden
    className={cn(
      "inline-block size-2 shrink-0 rounded-full",
      status === "done" && "bg-success",
      status === "outdated" && "bg-warn",
      status === "missing" && "ring-muted-foreground/60 ring-1 ring-inset",
    )}
  />
);

export const TranslateMenu = ({
  languages,
  onPick,
  sourceName,
}: {
  languages: TranslationLanguage[];
  onPick: (code: string) => void;
  sourceName: string;
}) => {
  const t = useTranslations("@vitnode/blog.admin.article.editor.translate");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="sm" variant="outline" />}>
        <LanguagesIcon />
        <span className="sr-only sm:not-sr-only">{t("button")}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            {t("menu", { language: sourceName })}
          </DropdownMenuLabel>
          {languages.map(language => {
            const status =
              language.missing > 0
                ? "missing"
                : language.outdated
                  ? "outdated"
                  : "done";

            return (
              <DropdownMenuItem
                key={language.code}
                onClick={() => {
                  onPick(language.code);
                }}
              >
                <StatusDot status={status} />
                <span className="flex-1">{language.name}</span>
                <span className="text-muted-foreground text-xs">
                  {status === "missing"
                    ? t("missing", { count: language.missing })
                    : status === "outdated"
                      ? t("outdated")
                      : t("complete")}
                </span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const ActiveTranslation = ({
  onExit,
  sourceName,
  targetName,
}: {
  onExit: () => void;
  sourceName: string;
  targetName: string;
}) => {
  const t = useTranslations("@vitnode/blog.admin.article.editor.translate");

  return (
    <span
      aria-label={t("active", { language: targetName })}
      className="bg-primary/10 text-primary inline-flex h-8 items-center gap-1.5 rounded-md ps-2.5 pe-1 text-sm font-medium"
      role="status"
    >
      <span className="hidden sm:inline">{sourceName}</span>
      <ArrowRightIcon aria-hidden className="hidden size-3.5 sm:inline" />
      {targetName}
      <button
        aria-label={t("exit")}
        className="hover:bg-primary/10 focus-visible:ring-ring/50 relative grid size-6 place-items-center rounded-sm outline-none before:absolute before:-inset-1.5 focus-visible:ring-3"
        onClick={onExit}
        type="button"
      >
        <XIcon className="size-3.5" />
      </button>
    </span>
  );
};

export const AiButton = ({
  disabled,
  label,
  onClick,
  pending,
  pendingLabel,
}: {
  disabled?: boolean;
  label: string;
  onClick: () => void;
  pending: boolean;
  pendingLabel: string;
}) => (
  <Button
    className="text-primary"
    disabled={(disabled ?? false) || pending}
    onClick={onClick}
    size="xs"
    type="button"
    variant="ghost"
  >
    {pending ? (
      <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" />
    ) : (
      <SparklesIcon />
    )}
    {pending ? pendingLabel : label}
  </Button>
);

export const PairRow = ({
  action,
  children,
  source,
  sourceName,
  status,
  targetName,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  source: React.ReactNode;
  sourceName: string;
  status: FieldStatus;
  targetName: string;
}) => {
  const t = useTranslations("@vitnode/blog.admin.article.editor.translate");

  return (
    <section className="flex flex-col gap-3">
      <div className="text-muted-foreground grid grid-cols-1 items-center gap-6 text-xs font-medium md:grid-cols-2">
        <span className="hidden md:inline">
          {t("source", { language: sourceName })}
        </span>
        <span className="flex min-h-6 items-center gap-1.5">
          <StatusDot status={status === "done" ? "done" : "missing"} />
          {targetName}
          <span className="sr-only">: {t(`status.${status}`)}</span>
          {action ? <span className="ms-auto">{action}</span> : null}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-6">
        <div className="text-muted-foreground hidden min-w-0 md:block">
          {source}
        </div>
        <div className="flex min-w-0 flex-col gap-2">{children}</div>
      </div>
    </section>
  );
};

export const OutdatedBanner = ({
  action,
  onDismiss,
  sourceName,
}: {
  action?: React.ReactNode;
  onDismiss: () => void;
  sourceName: string;
}) => {
  const t = useTranslations("@vitnode/blog.admin.article.editor.translate");

  return (
    <div
      className="bg-warn/10 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2 text-sm"
      role="status"
    >
      <span className="min-w-0 flex-1 leading-relaxed text-pretty">
        {t("outdated_banner", { language: sourceName })}
      </span>
      <div className="flex gap-1">
        {action}
        <Button onClick={onDismiss} size="xs" type="button" variant="ghost">
          {t("dismiss")}
        </Button>
      </div>
    </div>
  );
};
