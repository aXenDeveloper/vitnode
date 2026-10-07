import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { EyeOffIcon, SaveIcon, SendIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { AutoFormSubmitButton } from "@/components/form/auto-form";
import { Button } from "@/components/ui/button";
import { contentPublicationTransition } from "@/content/publication";

import { useContentForm } from "./context";
import { ContentFormPublication } from "./publication-status";
import {
  ContentFormButtonSkeleton,
  ContentFormStatusSkeleton,
} from "./skeleton";
import {
  ContentFormHiddenNotice,
  ContentFormVisibilityToggle,
  useContentFormHidden,
} from "./visibility";

export const ContentFormSubmit = ({
  label,
  withPublicationToggle = true,
  withVisibilityToggle = true,
}: {
  label?: React.ReactNode;
  withPublicationToggle?: boolean;
  /** The Hide / Unhide button, for a content type with visibility enabled. */
  withVisibilityToggle?: boolean;
}) => {
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
      {mode === "edit" && withVisibilityToggle ? (
        <ContentFormVisibilityToggle />
      ) : null}
      {mode === "edit" && withPublicationToggle ? (
        <ContentFormPublicationToggle />
      ) : null}
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
  const hidden = useContentFormHidden();
  const { canPublish, enabled, status, transition } = publication;

  if (!enabled || !canPublish || !transition) return null;

  const { action, destructive: published } =
    contentPublicationTransition(status);
  const Icon = published ? EyeOffIcon : SendIcon;
  const description = tContent.rich(`${action}.desc`, {
    title: () => (
      <span className="text-foreground font-bold">{title ?? singular}</span>
    ),
  });

  return (
    <ConfirmActionAlertDialog
      description={
        hidden && action === "publish" ? (
          <>
            {description} {tContent("visibility.publish_note")}
          </>
        ) : (
          description
        )
      }
      icon={<Icon />}
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
  const { mode, publication, skeleton, visibility } = useContentForm();

  if (!publication.enabled || mode === "create") return null;

  if (skeleton) return <ContentFormStatusSkeleton />;

  return (
    <div className="flex flex-col gap-2">
      <ContentFormPublication
        hiddenAt={visibility?.enabled ? visibility.hiddenAt : undefined}
        publishedAt={publication.publishedAt}
        status={publication.status}
      />
      <ContentFormHiddenNotice />
    </div>
  );
};

export const ContentFormActions = ({
  cancelHref,
  children,
  className,
  submitLabel,
  withPublicationToggle,
  withVisibilityToggle,
  ...props
}: React.ComponentProps<"div"> & {
  cancelHref?: string;
  submitLabel?: React.ReactNode;
  withPublicationToggle?: boolean;
  withVisibilityToggle?: boolean;
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
          render={<Link to={cancelHref} />}
          variant="ghost"
        >
          {t("cancel")}
        </Button>
      ) : null}
      <ContentFormSubmit
        label={submitLabel}
        withPublicationToggle={withPublicationToggle}
        withVisibilityToggle={withVisibilityToggle}
      />
    </div>
  );
};
