import { ArrowLeftIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { Button } from "./button";

interface HeaderContentH1Props {
  h1: React.ReactNode | string;
  h2?: never;
}

interface HeaderContentH2Props {
  h1?: never;
  h2: React.ReactNode | string;
}

export interface HeaderContentBack {
  href: string;
  label: React.ReactNode;
}

/**
 * The anchor a back link ends up rendering.
 *
 * Every prop of one, not just `href`: the button around it is a Base UI
 * `render`, which clones the element with the children, the class name and the
 * ref it needs to stay a button. A wrapper that accepted only `href` would drop
 * all three, so the type says so.
 */
export interface HeaderContentBackLinkProps extends Omit<
  React.ComponentProps<"a">,
  "href"
> {
  href: string;
}

/**
 * The one thing this header cannot decide for itself.
 *
 * Turning `/admin/blog` into a client-side navigation is the single question
 * whose answer differs between the two frameworks: Next.js wants `next-intl`'s
 * locale-aware `Link` (`@/lib/navigation`), TanStack Start wants the router's
 * own. Both are a component taking {@link HeaderContentBackLinkProps}, so the
 * header takes one and stops caring - and importing neither is what lets a
 * TanStack Start route render this component at all. The same boundary
 * `SearchFeedContent` draws for a search hit, for the same reason.
 *
 * It is required alongside `back` rather than defaulting to `<a>`: a missing
 * wrapper would otherwise degrade silently into a full document reload.
 */
export type HeaderContentBackLinkComponent = (
  props: HeaderContentBackLinkProps,
) => React.ReactNode;

/**
 * A back link, or neither half of one.
 *
 * Written as a union so `back` without `BackLink` is a type error at the call
 * site. The alternative - two independent optional props - compiles, renders
 * nothing, and looks like a header whose back button was never designed.
 */
type HeaderContentBackProps =
  | { back: HeaderContentBack; BackLink: HeaderContentBackLinkComponent }
  | { back?: never; BackLink?: never };

interface HeaderContentBaseProps {
  children?: React.ReactNode;
  className?: string;
  desc?: React.ReactNode;
  ref?: React.RefCallback<HTMLDivElement>;
}

export type HeaderContentProps = HeaderContentBackProps &
  HeaderContentBaseProps &
  (HeaderContentH1Props | HeaderContentH2Props);

export const HeaderContent = ({
  BackLink,
  back,
  children,
  className,
  desc,
  h1,
  h2,
  ref,
}: HeaderContentProps) => {
  return (
    <div
      className={cn(
        "mb-6 flex min-h-9 flex-col items-start gap-2 sm:flex-row sm:gap-4",
        className,
      )}
      ref={ref}
    >
      <div className="h-full flex-1 space-y-1 text-left sm:self-center">
        {h1 ? (
          <h1 className="text-foreground text-2xl font-bold sm:text-3xl">
            {h1}
          </h1>
        ) : (
          <h2 className="text-foreground text-xl font-bold sm:text-2xl">
            {h2}
          </h2>
        )}
        {!!desc && <div className="text-muted-foreground">{desc}</div>}
      </div>

      {!!back || !!children ? (
        <div className="flex w-full flex-col flex-wrap items-center justify-center gap-2 sm:w-auto sm:flex-row [&>*]:w-full [&>*]:sm:w-auto">
          {back && BackLink ? (
            <Button
              nativeButton={false}
              render={<BackLink href={back.href} />}
              variant="outline"
            >
              <ArrowLeftIcon />
              {back.label}
            </Button>
          ) : null}
          {children}
        </div>
      ) : null}
    </div>
  );
};
