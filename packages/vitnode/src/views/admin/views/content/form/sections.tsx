// No "use client": reached only from `content-form`, which is already a client
// entry - the same reason the primitives beside it declare none.
import { useTranslations } from "next-intl";
import React from "react";

import type { ContentFormSectionSpec } from "@/content/admin/spec";

import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter, useDialog } from "@/components/ui/dialog";

import { useContentForm } from "./context";
import {
  ContentFormField,
  ContentFormRemainingFields,
  ContentFormSection,
  ContentFormSubmit,
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
  const { setIsDirty } = useDialog();

  if (!setIsDirty) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <ContentFormSubmit />
      </div>
    );
  }

  return (
    <DialogFooter>
      <DialogClose render={<Button variant="ghost">{t("cancel")}</Button>} />
      <ContentFormSubmit />
    </DialogFooter>
  );
};

/**
 * The generated arrangement: one titled card per `admin.form.sections` entry,
 * or the fields stacked in declaration order when none are declared.
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
  const { fieldNames } = useContentForm();
  const placed = new Set(sections.flatMap(section => section.fields));
  const hasRemaining = fieldNames.some(name => !placed.has(name));

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
        Every field, when there are no sections; nothing, when there are -
        `admin.form.sections` *is* the field list, checked at define time. Still
        rendered in that case because the alternative failure is silent: a field
        the spec carries but no section names would be dropped from the payload
        rather than merely misplaced.
      */}
      {hasRemaining ? (
        <div className="flex flex-col gap-6">
          <ContentFormRemainingFields exclude={[...placed]} />
        </div>
      ) : null}

      <ContentFormSectionsFooter />
    </div>
  );
};
