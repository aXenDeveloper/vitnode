import { cn } from "cn";
import { TriangleAlertIcon } from "lucide-react";
import React from "react";

/**
 * A red-tinted section for irreversible actions, such as deleting an account,
 * framed like the settings groups beside it. Put each action in a
 * {@link DangerZoneItem}; other children need their own padding.
 *
 * @example
 * ```tsx
 * <DangerZone title="Danger zone">
 *   <DangerZoneItem description="..." title="Delete account">
 *     <Button variant="destructive">Delete</Button>
 *   </DangerZoneItem>
 * </DangerZone>
 * ```
 */
export const DangerZone = ({
  children,
  className,
  description,
  headingLevel = 2,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
  /** The heading's level in the page outline. Defaults to `2`. */
  headingLevel?: 2 | 3;
  title: React.ReactNode;
}) => {
  const titleId = React.useId();
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "bg-destructive/5 text-foreground ring-destructive/25 dark:bg-destructive/10 @container flex flex-col rounded-lg p-1 ring-1",
        className,
      )}
    >
      <div className="flex min-h-12 flex-col justify-center gap-0.5 px-3 py-2">
        <Heading
          className="text-destructive flex items-center gap-2 text-base leading-normal font-semibold text-balance"
          id={titleId}
        >
          <TriangleAlertIcon aria-hidden="true" className="size-4 shrink-0" />
          {title}
        </Heading>
        {description ? (
          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            {description}
          </p>
        ) : null}
      </div>
      <div className="bg-card text-card-foreground ring-destructive/20 [&>*:not(:last-child)]:border-destructive/15 flex flex-col overflow-hidden rounded-md shadow-xs ring-1 [&>*:not(:last-child)]:border-b">
        {children}
      </div>
    </section>
  );
};

/** One irreversible action in a {@link DangerZone}: what it does, and its controls. */
export const DangerZoneItem = ({
  children,
  description,
  title,
}: {
  /** The action's controls, beside the text when the zone is wide enough. */
  children?: React.ReactNode;
  description?: React.ReactNode;
  title: React.ReactNode;
}) => (
  <div className="flex flex-col gap-3 p-4 @xl:flex-row @xl:items-center @xl:justify-between @xl:gap-6">
    <div className="flex min-w-0 flex-col gap-1">
      <p className="text-foreground text-sm font-medium">{title}</p>
      {description ? (
        <div className="text-muted-foreground flex flex-col gap-2 text-sm leading-relaxed text-pretty">
          {description}
        </div>
      ) : null}
    </div>
    {children ? (
      <div className="flex shrink-0 flex-wrap gap-2">{children}</div>
    ) : null}
  </div>
);
