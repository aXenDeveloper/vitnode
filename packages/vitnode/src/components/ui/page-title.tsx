import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { ArrowLeftIcon } from "lucide-react";

import { Button } from "./button";

interface PageTitleH1Props {
  h1: React.ReactNode | string;
  h2?: never;
}

interface PageTitleH2Props {
  h1?: never;
  h2: React.ReactNode | string;
}

export interface PageTitleBack {
  href: string;
  label: React.ReactNode;
}

interface PageTitleBaseProps {
  back?: PageTitleBack;
  children?: React.ReactNode;
  className?: string;
  desc?: React.ReactNode;
  ref?: React.RefCallback<HTMLDivElement>;
  subtitle?: React.ReactNode;
}

export type PageTitleProps = PageTitleBaseProps &
  (PageTitleH1Props | PageTitleH2Props);

export const PageTitle = ({
  back,
  children,
  className,
  desc,
  h1,
  h2,
  ref,
  subtitle,
}: PageTitleProps) => {
  return (
    <div
      className={cn(
        "mb-6 flex min-h-9 flex-col items-start gap-2 sm:flex-row sm:gap-4",
        className,
      )}
      ref={ref}
    >
      <div className="h-full flex-1 space-y-1 text-left sm:self-center">
        {!!subtitle && (
          <p className="text-muted-foreground text-sm font-medium">
            {subtitle}
          </p>
        )}
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
          {back ? (
            <Button
              nativeButton={false}
              render={<Link to={back.href} />}
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
