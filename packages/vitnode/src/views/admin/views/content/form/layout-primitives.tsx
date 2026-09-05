import React from "react";

import { HeaderContent } from "@/components/ui/header-content";
import { cn } from "@/lib/utils";

import { useContentForm } from "./context";

export const ContentFormHeader = ({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) => {
  const { header, LinkComponent, markHeaderRendered } = useContentForm();

  markHeaderRendered?.();

  if (!header) return null;

  return (
    <HeaderContent
      back={header.back}
      BackLink={LinkComponent}
      className={className}
      desc={header.desc}
      h1={header.title}
    >
      {children}
    </HeaderContent>
  );
};

export const ContentFormLayoutGrid = ({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) => (
  <div
    className={cn(
      "grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

export const ContentFormMain = ({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) => (
  <div className={cn("flex min-w-0 flex-col gap-6", className)} {...props}>
    {children}
  </div>
);

export const ContentFormSidebar = ({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) => (
  <div
    className={cn("flex flex-col gap-4 lg:sticky lg:top-4", className)}
    {...props}
  >
    {children}
  </div>
);

export const ContentFormSection = ({
  children,
  className,
  desc,
  title,
  ...props
}: Omit<React.ComponentProps<"section">, "title"> & {
  desc?: React.ReactNode;
  title?: React.ReactNode;
}) => (
  <section
    className={cn("bg-card rounded-lg border p-4", className)}
    {...props}
  >
    {title ? (
      <div className="mb-4 flex flex-col gap-1">
        <h2 className="text-base leading-none font-semibold">{title}</h2>
        {desc ? (
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {desc}
          </p>
        ) : null}
      </div>
    ) : null}

    <div className="flex flex-col gap-6">{children}</div>
  </section>
);
