// No "use client": reached only from `content-form`, which is already a client
// entry - the same reason the primitives beside it declare none.
import { useTranslations } from "next-intl";
import React from "react";

import type { ContentFormSectionSpec } from "@/content/admin/spec";

import { AutoFormSubmitButton } from "@/components/form/auto-form";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter, useDialog } from "@/components/ui/dialog";

import { useContentForm } from "./context";
import {
  ContentFormField,
  ContentFormRemainingFields,
  ContentFormSection,
} from "./primitives";

/**
 * The submit row, matching whichever surface the form is on.
 *
 * `AutoForm` renders no button of its own once a layout is in play, so the row
 * has to be here - and it has to be the *same* row the ungrouped form has, or
 * adding `admin.form.sections` would quietly cost a dialog its Cancel button.
 * `useDialog` is what tells the two apart, exactly as `AutoForm` itself decides.
 */
const ContentFormSectionsFooter = () => {
  const t = useTranslations("core.global");
  const tContent = useTranslations("core.content");
  const { setIsDirty } = useDialog();
  const { mode } = useContentForm();
  const submit = (
    <AutoFormSubmitButton>
      {tContent(mode === "create" ? "create.submit" : "edit.submit")}
    </AutoFormSubmitButton>
  );

  if (!setIsDirty) return submit;

  return (
    <DialogFooter>
      <DialogClose render={<Button variant="ghost">{t("cancel")}</Button>} />
      {submit}
    </DialogFooter>
  );
};

/**
 * The layout `admin.form.sections` generates: one titled card per section.
 *
 * Built from the very primitives a plugin's own layout uses, so a declared
 * section and a hand-written one are the same card - the declarative form is a
 * shorthand for the override, not a second rendering path that can drift from it.
 *
 * Headings arrive already translated on the spec. Nothing here reads a message
 * for them, because the server is the only place that has the plugin's messages
 * and the request's locale together.
 */
export const ContentFormSections = ({
  sections,
}: {
  sections: readonly ContentFormSectionSpec[];
}) => {
  const placed = sections.flatMap(section => section.fields);

  return (
    <div className="flex flex-col gap-4">
      {sections.map(section => (
        <ContentFormSection
          desc={section.desc}
          key={section.name}
          title={section.title}
        >
          {section.fields.map(name => (
            <ContentFormField key={name} name={name} />
          ))}
        </ContentFormSection>
      ))}

      {/*
        Nothing, in the normal case: `admin.form.sections` *is* the field list,
        checked at define time. It is here because the alternative failure is
        silent - a field the spec carries but no section names would be dropped
        from the payload rather than merely misplaced.
      */}
      <ContentFormRemainingFields exclude={placed} />

      <ContentFormSectionsFooter />
    </div>
  );
};
