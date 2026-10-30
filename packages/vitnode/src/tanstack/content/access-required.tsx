import { Link, useRouterState } from "@tanstack/react-router";
import { LockIcon, LogInIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

import { LOGIN_PATH, returnToFor } from "../auth/redirects";
import { useSessionQuery } from "../auth/session-query";
import { RouteMessages } from "../i18n/route-messages";

/** The message namespaces the access panels render with. */
export const CONTENT_ACCESS_NAMESPACES = ["core.access"] as const;

export interface ContentAccessRequiredProps {
  /** Rendered under the message, e.g. a link back to the parent forum. */
  children?: React.ReactNode;
  /** The heading level of the title. Defaults to `h1`, for a whole page. */
  headingLevel?: "h1" | "h2" | "h3";
  /** What is locked: reading a scope (default) or replying in it. */
  kind?: "comment" | "read";
}

const Inner = ({
  children,
  headingLevel = "h1",
  kind = "read",
}: ContentAccessRequiredProps) => {
  const t = useTranslations("core.access");
  const session = useSessionQuery();
  const returnTo = useRouterState({
    select: state => returnToFor(state.location),
  });
  const Heading = headingLevel;

  if (session.isPending) {
    return (
      <div
        aria-busy="true"
        className="flex flex-col gap-3 rounded-xl border p-6"
      >
        <span className="sr-only" role="status">
          {t("loading")}
        </span>
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  const signedIn = Boolean(session.data?.user);
  const key = signedIn ? `${kind}.member` : `${kind}.guest`;

  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LockIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle render={<Heading />}>
          {t(`${key}.title` as "read.guest.title")}
        </EmptyTitle>
        <EmptyDescription>
          {t(`${key}.desc` as "read.guest.desc")}
        </EmptyDescription>
      </EmptyHeader>
      {signedIn && !children ? null : (
        <EmptyContent>
          {signedIn ? null : (
            <Link
              className={buttonVariants()}
              search={{ returnTo }}
              to={LOGIN_PATH}
            >
              <LogInIcon aria-hidden="true" />
              {t("sign_in")}
            </Link>
          )}
          {children}
        </EmptyContent>
      )}
    </Empty>
  );
};

/**
 * What a reader sees in place of content they may not read, or a reply box
 * they may not use: a guest is asked to sign in, a member is told they have
 * no access. It names nothing about the content itself. Show it when a
 * Content Engine route answered `403` with `accessRequired`, or when a
 * container's `access` flags say so - the server has already decided.
 *
 * @example
 * ```tsx
 * import { ContentAccessRequired } from "@vitnode/core/tanstack/content";
 *
 * if (!forum.access.canRead) return <ContentAccessRequired />;
 * ```
 */
export const ContentAccessRequired = (props: ContentAccessRequiredProps) => (
  <React.Suspense fallback={null}>
    <RouteMessages namespaces={CONTENT_ACCESS_NAMESPACES}>
      <Inner {...props} />
    </RouteMessages>
  </React.Suspense>
);
