import { cn } from "cn";
import { useTranslations } from "use-intl";

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
