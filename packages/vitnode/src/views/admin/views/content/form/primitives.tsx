// No "use client": reached only from a layout, which is reached only from
// `content-form` / `translation-panel` - both already client entries.
import { useTranslations } from "next-intl";
import React from "react";

import { AutoFormSubmitButton } from "@/components/form/auto-form";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/navigation";
import { cn } from "@/lib/utils";

import { useContentForm } from "./context";
import { ContentFormPublication } from "./publication-status";

/**
 * One field of the surrounding form, wherever the layout puts it.
 *
 * Renders **nothing** for a name this surface does not have, and that is load
 * bearing rather than lenient: a localized content type splits its fields across
 * a shared surface and a per-language one, so one layout naming `title` and
 * `category` places each on the tab it belongs to without ever asking which
 * table it lives on.
 *
 * A field override registered in `buildPlugin` is already baked into the element
 * this renders - overrides and layouts compose, neither replaces the other.
 */
export const ContentFormField = ({ name }: { name: string }) => {
  const { fields, markRendered } = useContentForm();

  markRendered?.(name);

  return <>{fields[name] ?? null}</>;
};

/**
 * Every field this surface has that the layout has not named itself.
 *
 * The escape hatch for a layout that wants to place two fields deliberately and
 * let the rest fall where they may - and the reason a field added to the
 * definition later does not silently vanish from a layout written today.
 */
export const ContentFormRemainingFields = ({
  exclude = [],
}: {
  exclude?: readonly string[];
}) => {
  const { fieldNames, fields, markRendered } = useContentForm();
  const skip = new Set(exclude);
  const remaining = fieldNames.filter(name => !skip.has(name));

  for (const name of remaining) markRendered?.(name);

  return (
    <>
      {remaining.map(name => (
        <React.Fragment key={name}>{fields[name]}</React.Fragment>
      ))}
    </>
  );
};

/**
 * The read-only publication line, for a layout that wants it in its sidebar.
 *
 * Renders nothing for a content type without `publication`, and nothing while
 * creating - there is no lifecycle to report before the record exists.
 */
export const ContentFormStatus = () => {
  const { mode, publication } = useContentForm();

  if (!publication.enabled || mode === "create") return null;

  return (
    <ContentFormPublication
      publishedAt={publication.publishedAt}
      status={publication.status}
    />
  );
};

/**
 * The submit row.
 *
 * The button is the surrounding `AutoForm`'s own, so it disables while
 * submitting and while the schema is unsatisfied exactly like the generated
 * one - a layout cannot accidentally ship a button that allows a double write.
 */
export const ContentFormActions = ({
  cancelHref,
  children,
  className,
  submitLabel,
  ...props
}: React.ComponentProps<"div"> & {
  /** Renders a Cancel link back to the list. */
  cancelHref?: string;
  submitLabel?: React.ReactNode;
}) => {
  const t = useTranslations("core.global");
  const tContent = useTranslations("core.content");
  const { mode } = useContentForm();

  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      {...props}
    >
      {children}
      {cancelHref ? (
        <Button
          nativeButton={false}
          render={<Link href={cancelHref} />}
          variant="ghost"
        >
          {t("cancel")}
        </Button>
      ) : null}
      <AutoFormSubmitButton>
        {submitLabel ??
          tContent(mode === "create" ? "create.submit" : "edit.submit")}
      </AutoFormSubmitButton>
    </div>
  );
};

/**
 * The two-column editor shell: a wide main column and a sidebar.
 *
 * Single column below `lg`, which is the only responsive decision worth making
 * here - a metadata sidebar next to a 40-character-wide editor is worse than no
 * sidebar at all.
 */
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

/**
 * The metadata column. Sticky on large screens so the actions stay reachable
 * while a long body scrolls, and static below that, where sticky would eat the
 * viewport.
 */
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

/** A titled card. Renders no heading element when it has no title. */
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
