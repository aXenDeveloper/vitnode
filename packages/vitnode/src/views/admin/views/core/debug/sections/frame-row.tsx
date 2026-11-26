import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { ChevronRightIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { debugTabPath } from "@/tanstack/admin/debug/route-search";
import { HrefLink } from "@/tanstack/link";

import type { DebugCheck } from "../health/health";

import { isProblem } from "../health/health";
import { TONE_TEXT, ToneIcon } from "../tone";

export const FRAME_ACTION_STACKED =
  "max-sm:col-start-1 max-sm:row-span-1 max-sm:row-start-3 max-sm:justify-self-start max-sm:pt-2";

export const FrameRow = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("flex items-center gap-3 px-4 py-3", className)}>
    {children}
  </div>
);

export const FactRow = ({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) => (
  <FrameRow>
    <span className="text-muted-foreground flex-1 text-sm">{label}</span>
    <span className="text-end text-sm font-medium tabular-nums">{value}</span>
  </FrameRow>
);

export const CheckRow = ({ check }: { check: DebugCheck }) => {
  const t = useTranslations("admin.debug.health");
  const loud = isProblem(check.tone);

  return (
    <FrameRow className="flex-wrap">
      <ToneIcon tone={check.tone} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            "text-sm text-pretty",
            loud ? cn("font-medium", TONE_TEXT[check.tone]) : "text-foreground",
          )}
        >
          {t(check.message.key, check.message.values)}
        </span>
        {check.detail ? (
          <span className="text-muted-foreground text-xs leading-relaxed break-words">
            {check.detail}
          </span>
        ) : null}
      </span>
    </FrameRow>
  );
};

const ISSUE_ROW_LINK =
  "hover:bg-muted/50 focus-visible:bg-muted/50 flex items-center gap-3 px-4 py-3 text-start transition-colors outline-none";

export const IssueRow = ({ issue }: { issue: DebugCheck }) => {
  const t = useTranslations("admin.debug.health");
  const row = (
    <>
      <ToneIcon tone={issue.tone} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium text-pretty">
          {t(issue.message.key, issue.message.values)}
        </span>
        {issue.detail ? (
          <span className="text-muted-foreground truncate text-xs">
            {issue.detail}
          </span>
        ) : null}
      </span>
      <ChevronRightIcon
        aria-hidden
        className="text-muted-foreground size-4 shrink-0"
      />
    </>
  );

  return issue.href ? (
    <HrefLink className={ISSUE_ROW_LINK} href={issue.href}>
      {row}
    </HrefLink>
  ) : (
    <Link
      className={ISSUE_ROW_LINK}
      resetScroll={false}
      to={debugTabPath(issue.tab)}
    >
      {row}
    </Link>
  );
};

export const SectionHeader = ({
  action,
  badge,
  description,
  title,
}: {
  action?: React.ReactNode;
  badge?: React.ReactNode;
  description: React.ReactNode;
  title: React.ReactNode;
}) => (
  <header className="flex flex-wrap items-start justify-between gap-4">
    <div className="flex min-w-0 flex-col gap-1">
      <h2 className="flex items-center gap-2 text-xl font-semibold text-balance">
        {title}
        {badge}
      </h2>
      <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
        {description}
      </p>
    </div>
    {action}
  </header>
);
