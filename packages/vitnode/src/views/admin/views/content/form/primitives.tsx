// No "use client": reached only from a layout, which is reached only from
// `content-form`, which is already a client entry.
import { EyeOffIcon, SaveIcon, SendIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { AutoFormSubmitButton } from "@/components/form/auto-form";
import { Button } from "@/components/ui/button";
import { HeaderContent } from "@/components/ui/header-content";
import { Link } from "@/lib/navigation";
import { cn } from "@/lib/utils";

import { useContentForm } from "./context";
import { ContentFormPublication } from "./publication-status";

export const ContentFormHeader = ({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) => {
  const { header, markHeaderRendered } = useContentForm();

  markHeaderRendered?.();

  if (!header) return null;

  return (
    <HeaderContent
      back={header.back}
      className={className}
      desc={header.desc}
      h1={header.title}
    >
      {children}
    </HeaderContent>
  );
};

export const ContentFormSubmit = ({ label }: { label?: React.ReactNode }) => {
  const tContent = useTranslations("core.content");
  const { mode, publication } = useContentForm();

  if (mode === "create" && publication.enabled) {
    return (
      <>
        <AutoFormSubmitButton
          intent="draft"
          variant={publication.canPublish ? "outline" : "default"}
        >
          <SaveIcon />
          {tContent("create.save_draft")}
        </AutoFormSubmitButton>
        {publication.canPublish ? (
          <AutoFormSubmitButton intent="publish">
            <SendIcon />
            {tContent("create.publish")}
          </AutoFormSubmitButton>
        ) : null}
      </>
    );
  }

  return (
    <>
      {mode === "edit" ? <ContentFormPublicationToggle /> : null}
      <AutoFormSubmitButton>
        {label ?? tContent(mode === "create" ? "create.submit" : "edit.submit")}
      </AutoFormSubmitButton>
    </>
  );
};

const ContentFormPublicationToggle = () => {
  const tContent = useTranslations("core.content");
  const { publication, singular, title } = useContentForm();
  const { canPublish, enabled, status, transition } = publication;

  if (!enabled || !canPublish || !transition) return null;

  const published = status === "published";
  const action = published ? "unpublish" : "publish";
  const Icon = published ? EyeOffIcon : SendIcon;

  return (
    <ConfirmActionAlertDialog
      description={tContent.rich(`${action}.desc`, {
        title: () => (
          <span className="text-foreground font-bold">{title ?? singular}</span>
        ),
      })}
      onSubmit={async ({ onClose }) => {
        // Left open on failure, so the reason is still on screen next to the
        // thing that failed - the same behaviour as the row action.
        if (await transition(action)) onClose();
      }}
      submitVariant={published ? "destructive" : "default"}
      textSubmit={tContent(`${action}.confirm`)}
      title={tContent(`${action}.title`, { name: singular })}
    >
      {/* Explicitly not a submit: it sits inside the record's own form. */}
      <Button type="button" variant="outline">
        <Icon />
        {tContent(published ? "edit.unpublish" : "edit.publish")}
      </Button>
    </ConfirmActionAlertDialog>
  );
};

export const ContentFormField = ({ name }: { name: string }) => {
  const { fields, markRendered } = useContentForm();

  markRendered?.(name);

  return <>{fields[name] ?? null}</>;
};

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
 * The submit row - see `ContentFormSubmit` for which buttons it holds.
 *
 * Goes wherever the layout wants it: in a sidebar card, or inside
 * `ContentFormHeader` beside the back link.
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
  /**
   * Replaces the single submit button's label. Ignored while creating a record
   * with a lifecycle, where the row is "Save as draft" and "Publish".
   */
  submitLabel?: React.ReactNode;
}) => {
  const t = useTranslations("core.global");

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
      <ContentFormSubmit label={submitLabel} />
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
