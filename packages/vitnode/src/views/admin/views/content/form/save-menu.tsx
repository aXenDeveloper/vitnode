import {
  ChevronDownIcon,
  FileClockIcon,
  SaveIcon,
  SendIcon,
} from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { ContentPublicationAction } from "@/content/publication";
import type { ContentVisibilityAction } from "@/content/visibility";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { AutoFormSubmitButton } from "@/components/form/auto-form";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { contentPublicationTransition } from "@/content/publication";
import { contentVisibilityTransition } from "@/content/visibility";

import {
  CONTENT_VISIBILITY_ICONS,
  ContentVisibilityDialog,
} from "../actions/visibility-dialog";
import { useContentForm } from "./context";
import { ContentFormSubmit } from "./primitives";
import { ContentFormButtonSkeleton } from "./skeleton";
import { useContentFormHidden } from "./visibility";

const PUBLICATION_ICONS: Record<ContentPublicationAction, React.ReactNode> = {
  publish: <SendIcon />,
  unpublish: <FileClockIcon />,
};

type ContentFormMenuAction = ContentPublicationAction | ContentVisibilityAction;

const PublicationDialog = ({
  action,
  onOpenChange,
  open,
  triggerRef,
}: {
  action: ContentPublicationAction;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) => {
  const t = useTranslations("core.content");
  const { publication, singular, title } = useContentForm();
  const hidden = useContentFormHidden();
  const description = t.rich(`${action}.desc`, {
    title: () => (
      <span className="text-foreground font-bold">{title ?? singular}</span>
    ),
  });

  return (
    <ConfirmActionAlertDialog
      description={
        hidden && action === "publish" ? (
          <>
            {description} {t("visibility.publish_note")}
          </>
        ) : (
          description
        )
      }
      finalFocus={triggerRef}
      icon={PUBLICATION_ICONS[action]}
      onOpenChange={onOpenChange}
      onSubmit={async ({ onClose }) => {
        if (await publication.transition?.(action)) onClose();
      }}
      open={open}
      submitVariant={action === "unpublish" ? "destructive" : "default"}
      textSubmit={t(`${action}.confirm`)}
      title={t(`${action}.title`, { name: singular })}
    />
  );
};

export const ContentFormSaveMenu = () => {
  const t = useTranslations("core.content");
  const { mode, publication, singular, skeleton, title, visibility } =
    useContentForm();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [open, setOpen] = React.useState<ContentFormMenuAction | null>(null);
  const [shown, setShown] = React.useState<ContentFormMenuAction>("publish");

  if (skeleton) return <ContentFormButtonSkeleton />;
  if (mode === "create") return <ContentFormSubmit />;

  const choose = (action: ContentFormMenuAction) => {
    setShown(action);
    setOpen(action);
  };
  const onOpenChange = (next: boolean) => {
    if (!next) setOpen(null);
  };

  const publicationAction =
    publication.enabled && publication.canPublish && publication.transition
      ? contentPublicationTransition(publication.status).action
      : null;
  const visibilityAction =
    visibility?.enabled && visibility.canHide && visibility.transition
      ? contentVisibilityTransition({ hiddenAt: visibility.hiddenAt }).action
      : null;
  const visibilityTransition = visibility?.transition;

  return (
    <>
      <ButtonGroup>
        <AutoFormSubmitButton>
          <SaveIcon />
          <span className="max-sm:sr-only">{t("edit.submit")}</span>
        </AutoFormSubmitButton>
        {publicationAction || visibilityAction ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              ref={triggerRef}
              render={
                <Button
                  aria-label={t("table.more_actions")}
                  size="icon"
                  type="button"
                />
              }
            >
              <ChevronDownIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {publicationAction ? (
                <DropdownMenuItem
                  onClick={() => {
                    choose(publicationAction);
                  }}
                >
                  {PUBLICATION_ICONS[publicationAction]}
                  {t(`actions.${publicationAction}`)}
                </DropdownMenuItem>
              ) : null}
              {visibilityAction ? (
                <DropdownMenuItem
                  onClick={() => {
                    choose(visibilityAction);
                  }}
                >
                  {CONTENT_VISIBILITY_ICONS[visibilityAction]}
                  {t(`actions.${visibilityAction}`)}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </ButtonGroup>

      {shown === "publish" || shown === "unpublish" ? (
        <PublicationDialog
          action={shown}
          onOpenChange={onOpenChange}
          open={open === shown}
          triggerRef={triggerRef}
        />
      ) : visibilityTransition ? (
        <ContentVisibilityDialog
          action={shown}
          finalFocus={triggerRef}
          onConfirm={async () => await visibilityTransition(shown)}
          onOpenChange={onOpenChange}
          open={open === shown}
          singular={singular}
          title={title ?? singular}
        />
      ) : null}
    </>
  );
};
