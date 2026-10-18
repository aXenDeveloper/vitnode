import { cn } from "cn";
import React from "react";
import { useTranslations } from "use-intl";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import { ContentConfirmAction } from "./content";

/**
 * Asks for confirmation before a destructive action, such as a delete. The
 * `children` element opens it; omit it to control the dialog with `open` and
 * `onOpenChange`.
 *
 * `onSubmit` runs as a form action, with the confirm button spinning until it
 * settles; call its `onClose` to close the dialog after success. `title` and
 * `description` default to a generic "Are you sure?" text.
 *
 * @example
 * ```tsx
 * <ConfirmActionAlertDialog
 *   onSubmit={async ({ onClose }) => {
 *     await deletePost(id);
 *     onClose();
 *   }}
 * >
 *   <Button variant="destructive">Delete</Button>
 * </ConfirmActionAlertDialog>
 * ```
 */
export const ConfirmActionAlertDialog = ({
  children,
  title,
  description,
  finalFocus,
  icon,
  submitVariant = "destructive",
  textSubmit,
  onSubmit,
  ...props
}: Omit<React.ComponentProps<typeof AlertDialog>, "children"> &
  React.ComponentProps<typeof ContentConfirmAction> & {
    children?: React.ReactElement;
    description?: React.ReactNode;
    finalFocus?: React.ComponentProps<typeof AlertDialogContent>["finalFocus"];
    icon?: React.ReactNode;
    title?: React.ReactNode;
  }) => {
  const t = useTranslations("core.global.confirm_action");

  return (
    <AlertDialog {...props}>
      {children ? <AlertDialogTrigger render={children} /> : null}

      <AlertDialogContent
        finalFocus={finalFocus}
        size={icon ? "sm" : "default"}
      >
        <AlertDialogHeader>
          {icon ? (
            <AlertDialogMedia
              className={cn(
                submitVariant === "destructive" &&
                  "bg-destructive/10 text-destructive dark:bg-destructive/20",
              )}
            >
              {icon}
            </AlertDialogMedia>
          ) : null}
          <AlertDialogTitle>{title ?? t("title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {description ?? t("desc")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ContentConfirmAction
          onSubmit={onSubmit}
          submitVariant={submitVariant}
          textSubmit={textSubmit}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
};
