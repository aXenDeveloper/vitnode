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

export interface HeaderContentBackLinkProps extends Omit<
  React.ComponentProps<"a">,
  "href"
> {
  href: string;
}

export type HeaderContentBackLinkComponent = (
  props: HeaderContentBackLinkProps,
) => React.ReactNode;

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
