"use client";

import { useRouter } from "@/lib/navigation";

import type { EditStaffFormProps } from "./edit-staff-form-content";

import { staffListHref } from "../staff-model";
import { updateStaffPermissionsAction } from "../staff-mutations.server";
import { EditStaffFormContent } from "./edit-staff-form-content";

/**
 * {@link EditStaffFormContent}, wired to Next.js.
 *
 * Two bindings: the save is a Server Action, and "afterwards" is a locale-aware
 * push back to the list. Everything the form *decides* - which permissions
 * exist, what a toggle cascades to, what is finally sent - is `staff-model.ts`,
 * shared with the TanStack AdminCP and tested without React.
 */
export const EditStaffPermissionsForm = (
  props: Omit<EditStaffFormProps, "onSave" | "onSaved">,
) => {
  const { push } = useRouter();

  return (
    <EditStaffFormContent
      {...props}
      onSave={updateStaffPermissionsAction}
      onSaved={() => {
        push(staffListHref(props.type));
      }}
    />
  );
};
