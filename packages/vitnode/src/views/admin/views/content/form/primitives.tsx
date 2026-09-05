// No "use client": reached only from a layout, which is reached only from
// `content-form`, which is already a client entry.
import { EyeOffIcon, SaveIcon, SendIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { AutoFormSubmitButton } from "@/components/form/auto-form";
import { Button } from "@/components/ui/button";
import { contentPublicationTransition } from "@/content/publication";
import { cn } from "@/lib/utils";

import type { ContentFormLinkComponent } from "./context";

import { useContentForm } from "./context";
import { ContentFormPublication } from "./publication-status";
import {
  ContentFormButtonSkeleton,
  ContentFormStatusSkeleton,
} from "./skeleton";

export const ContentFormSubmit = ({ label }: { label?: React.ReactNode }) => {
  const tContent = useTranslations("core.content");
  const { mode, publication, skeleton } = useContentForm();

  if (skeleton) {
    return (
      <>
        {publication.enabled ? <ContentFormButtonSkeleton /> : null}
        <ContentFormButtonSkeleton />
      </>
    );
  }

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
        <SaveIcon />
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

  const { action, destructive: published } =
    contentPublicationTransition(status);
  const Icon = published ? EyeOffIcon : SendIcon;

  return (
    <ConfirmActionAlertDialog
      description={tContent.rich(`${action}.desc`, {
        title: () => (
          <span className="text-foreground font-bold">{title ?? singular}</span>
        ),
      })}
      onSubmit={async ({ onClose }) => {
        if (await transition(action)) onClose();
      }}
      submitVariant={published ? "destructive" : "default"}
      textSubmit={tContent(`${action}.confirm`)}
      title={tContent(`${action}.title`, { name: singular })}
    >
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

export const ContentFormStatus = () => {
  const { mode, publication, skeleton } = useContentForm();

  if (!publication.enabled || mode === "create") return null;

  if (skeleton) return <ContentFormStatusSkeleton />;

  return (
    <ContentFormPublication
      publishedAt={publication.publishedAt}
      status={publication.status}
    />
  );
};

export const ContentFormActions = ({
  cancelHref,
  children,
  className,
  submitLabel,
  ...props
}: React.ComponentProps<"div"> & {
  cancelHref?: string;
  submitLabel?: React.ReactNode;
}) => {
  const t = useTranslations("core.global");
  const { LinkComponent } = useContentForm();

  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      {...props}
    >
      {children}
      {cancelHref ? (
        <ContentFormCancel href={cancelHref} LinkComponent={LinkComponent}>
          {t("cancel")}
        </ContentFormCancel>
      ) : null}
      <ContentFormSubmit label={submitLabel} />
    </div>
  );
};

/**
 * The cancel button, wearing the host's link.
 *
 * Its own component so the injected one arrives as a **prop**: a component read
 * out of a hook and rendered in the same pass is a component created during
 * render, which React is entitled to remount. `HeaderContent` takes its
 * `BackLink` the same way, and for the same reason.
 */
const ContentFormCancel = ({
  children,
  href,
  LinkComponent,
}: {
  children: React.ReactNode;
  href: string;
  LinkComponent: ContentFormLinkComponent;
}) => (
  <Button
    nativeButton={false}
    render={<LinkComponent href={href} />}
    variant="ghost"
  >
    {children}
  </Button>
);
