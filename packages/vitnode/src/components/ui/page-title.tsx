import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { ArrowLeftIcon } from "lucide-react";

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
      <div className="flex h-full flex-1 flex-col gap-1 text-start sm:self-center">
        {back ? (
          <Link
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex w-fit items-center gap-1.5 rounded-sm text-sm font-medium transition-colors outline-none focus-visible:ring-3 [&_svg]:size-4"
            to={back.href}
          >
            <ArrowLeftIcon aria-hidden="true" />
            {back.label}
          </Link>
        ) : null}
        {!!subtitle && (
          <p className="text-muted-foreground text-sm font-medium">
            {subtitle}
          </p>
        )}
        {h1 ? (
          <h1 className="text-foreground text-2xl font-bold text-balance sm:text-3xl">
            {h1}
          </h1>
        ) : (
          <h2 className="text-foreground text-xl font-bold text-balance sm:text-2xl">
            {h2}
          </h2>
        )}
        {!!desc && <div className="text-muted-foreground">{desc}</div>}
      </div>

      {children ? (
        <div className="flex w-full flex-col flex-wrap items-center justify-center gap-2 sm:w-auto sm:flex-row [&>*]:w-full [&>*]:sm:w-auto">
          {children}
        </div>
      ) : null}
    </div>
  );
};
