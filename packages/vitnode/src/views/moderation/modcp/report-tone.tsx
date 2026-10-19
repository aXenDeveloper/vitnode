import { cn } from "cn";
import { useTranslations } from "use-intl";

import { Avatar } from "@/components/avatar";
import { FEEDBACK_TONE_TEXT } from "@/components/ui/feedback-tone";
import { UserFormat } from "@/components/user-format";

import type { ModcpReportDetail } from "./modcp-query";

export type ReportPerson = NonNullable<ModcpReportDetail["reporter"]>;
export type ReportStatus = ModcpReportDetail["report"]["status"];

export const TONE_SURFACE = {
  destructive: cn("bg-destructive/10", FEEDBACK_TONE_TEXT.destructive),
  info: cn("bg-primary/10", FEEDBACK_TONE_TEXT.info),
  muted: "bg-muted text-muted-foreground",
  success: cn("bg-success/12", FEEDBACK_TONE_TEXT.success),
  warning: cn("bg-warn/12", FEEDBACK_TONE_TEXT.warning),
} as const;

export type ToneName = keyof typeof TONE_SURFACE;

export const STATUS_TONE: Record<ReportStatus, ToneName> = {
  done: "success",
  in_progress: "info",
  new: "muted",
};

export const REASON_TONE: ToneName = "warning";

export const REASON_TEXT = FEEDBACK_TONE_TEXT.warning;

export const Chip = ({
  children,
  icon: Icon,
  tone,
}: {
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone: ToneName;
}) => (
  <span
    className={cn(
      "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
      TONE_SURFACE[tone],
    )}
  >
    {Icon ? <Icon aria-hidden className="size-3.5" /> : null}
    {children}
  </span>
);

export const StatusLozenge = ({ status }: { status: ReportStatus }) => {
  const t = useTranslations("core.moderation.statuses");

  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-sm px-1.5 text-xs font-bold tracking-wide whitespace-nowrap uppercase",
        TONE_SURFACE[STATUS_TONE[status]],
      )}
    >
      {t(status)}
    </span>
  );
};

export const PersonAvatar = ({
  className,
  person,
  size = 24,
}: {
  className?: string;
  person: ReportPerson;
  size?: number;
}) => (
  <Avatar
    alt=""
    className={cn("shrink-0 self-start", className)}
    size={size}
    style={{ height: size, width: size }}
    user={person}
  />
);

export const PersonName = ({
  className,
  link = false,
  person,
}: {
  className?: string;
  link?: boolean;
  person: Partial<Pick<ReportPerson, "nameCode">> &
    Pick<ReportPerson, "name" | "role">;
}) => (
  <UserFormat
    className={cn("min-w-0", className)}
    format
    link={link}
    user={{ name: person.name, nameCode: person.nameCode, role: person.role }}
  />
);

export const Person = ({
  link = false,
  person,
  size = 24,
}: {
  link?: boolean;
  person: ReportPerson;
  size?: number;
}) => (
  <span className="flex min-w-0 items-center gap-2">
    <PersonAvatar person={person} size={size} />
    <PersonName link={link} person={person} />
  </span>
);
