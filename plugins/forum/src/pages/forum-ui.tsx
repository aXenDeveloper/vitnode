import { parseContentContainerIcon } from "@vitnode/api/content/containers/icon";
import { Avatar } from "@vitnode/core/components/avatar";
import { DateFormat } from "@vitnode/core/components/date-format";
import { ContainerIcon } from "@vitnode/core/components/ui/container-icon";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@vitnode/core/components/ui/empty";
import { UserFormat } from "@vitnode/core/components/user-format";
import { UserPreview } from "@vitnode/core/components/user-preview";
import { cn } from "cn";
import { MessagesSquareIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import type { ForumPerson } from "./forum-data";

export const ForumShell = ({
  actions,
  children,
  description,
  title,
  wide,
}: {
  actions?: React.ReactNode;
  children: React.ReactNode;
  description?: null | string;
  title: React.ReactNode;
  /** Room for a sidebar next to the content on large screens. */
  wide?: boolean;
}) => (
  <div
    className={cn(
      "container mx-auto flex flex-col gap-6 px-4 py-8 md:gap-8 md:py-12",
      wide ? "max-w-6xl" : "max-w-4xl",
    )}
  >
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="flex min-w-0 flex-col gap-2">
        <h1 className="text-foreground flex items-center gap-3 text-3xl font-semibold tracking-tight text-balance">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground leading-relaxed text-pretty">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>

    {children}
  </div>
);

export const RefusedState = ({
  action,
  description,
  icon,
  title,
}: {
  action?: React.ReactNode;
  description: string;
  icon: React.ReactNode;
  title: string;
}) => (
  <div className="container mx-auto flex max-w-3xl px-4 py-8 md:py-12">
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle render={<h1 />}>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  </div>
);

export const ForumIcon = ({
  className,
  icon,
}: {
  className?: string;
  icon: null | string | undefined;
}) => {
  const isImage = parseContentContainerIcon(icon)?.type === "image";

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg",
        isImage ? "bg-muted" : "bg-primary/10 text-primary",
        className,
      )}
    >
      <ContainerIcon
        className={isImage ? "size-full rounded-none" : "size-5 text-xl"}
        fallback={<MessagesSquareIcon className="size-5" />}
        value={icon}
      />
    </span>
  );
};

const AVATAR_SIZE_CLASS = { 24: "size-6", 32: "size-8", 40: "size-10" };

export const PersonAvatar = ({
  person,
  size = 32,
}: {
  person: ForumPerson;
  size?: keyof typeof AVATAR_SIZE_CLASS;
}) =>
  person ? (
    <UserPreview
      className="shrink-0 rounded-full"
      decorative
      nameCode={person.nameCode}
    >
      <Avatar
        alt=""
        className={AVATAR_SIZE_CLASS[size]}
        size={size}
        user={person}
      />
    </UserPreview>
  ) : (
    <span
      aria-hidden="true"
      className={cn("bg-muted shrink-0 rounded-full", AVATAR_SIZE_CLASS[size])}
    />
  );

export const PersonName = ({ person }: { person: ForumPerson }) => {
  const t = useTranslations("@vitnode/forum.forums");

  return person ? (
    <UserFormat format link user={person} />
  ) : (
    <span className="text-muted-foreground font-medium">
      {t("deleted_user")}
    </span>
  );
};

export const TimeAgo = ({ date }: { date: string }) => (
  <time dateTime={new Date(date).toISOString()}>
    <DateFormat date={date} />
  </time>
);
