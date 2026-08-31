"use client";

import React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader } from "@/components/ui/loader";

/**
 * A Content Engine form in a dialog - the chrome, and nothing else.
 *
 * The one implementation of dialog-mode presentation, shared by three callers:
 * the Next.js list's create button and its rows' edit buttons, and the TanStack
 * Start list through the form slot it registers. They differ in what opens the
 * dialog and in how the form reaches the API; they must not differ in the dialog
 * itself, and before this existed the same six elements were written out twice.
 *
 * ## Why the trigger and the form are both handed in
 *
 * `children` is the control that opens it - a plain button on the create
 * heading, a tooltip-wrapped icon on a row - and it is rendered *through*
 * `DialogTrigger` rather than beside it, so the trigger's accessibility wiring
 * lands on the caller's own element instead of on a wrapper around it.
 *
 * `form` is an element rather than a component or children for one reason:
 * `DialogContent` does not render until the dialog opens, so the element sits
 * unrendered until then. Nothing inside it runs - no hooks, no spec build, no
 * lazy chunk fetched - which is what keeps a list of fifty rows from building
 * fifty form specs for dialogs nobody opened. It is also why `ContentForm` is
 * reached through `React.lazy` on both sides: the AutoForm stack and every field
 * component load when somebody actually opens a form.
 */
export const ContentFormDialog = ({
  children,
  description,
  form,
  title,
}: {
  /** The control that opens the dialog. */
  children: React.ReactElement;
  description: React.ReactNode;
  /** The form itself. Not rendered until the dialog opens. */
  form: React.ReactNode;
  title: React.ReactNode;
}) => (
  <Dialog>
    <DialogTrigger render={children} />

    <DialogContent>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <React.Suspense fallback={<Loader />}>{form}</React.Suspense>
    </DialogContent>
  </Dialog>
);
