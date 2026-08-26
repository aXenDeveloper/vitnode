// No "use client" here on purpose: this module is only reached from
// `content-form`, which is already a client entry.
// Declaring it again would make it a nested client entry, and `next/dynamic`
// cannot resolve one from inside a published package.
import React from "react";

import type { HeaderContentBack } from "@/components/ui/header-content";

export interface ContentFormHeaderValue {
  back: HeaderContentBack;
  desc?: React.ReactNode;
  title: React.ReactNode;
}

export interface ContentFormContextValue {
  /** Every field of the form, in declaration order. */
  fieldNames: string[];
  /** Every field, already rendered and keyed by name. */
  fields: Record<string, React.ReactNode>;
  /**
   * The page heading and its back link, for `ContentFormHeader` to render.
   *
   * `undefined` in a dialog. A page-mode layout is expected to place the header
   * itself, exactly as it places every field - which is what lets it put the
   * submit buttons beside the back link rather than in a sidebar.
   */
  header?: ContentFormHeaderValue;
  /**
   * Which of them hold one value per language.
   *
   * Informational, for a layout that wants to group or annotate them. A layout
   * does **not** need it to place a field: a localized input renders its own
   * language switcher, so `<ContentFormField name="title" />` works wherever it
   * is put, whichever table the value ends up on.
   */
  localizedFieldNames: string[];
  /** Records that a layout rendered the header, so a page never loses its heading silently. */
  markHeaderRendered?: () => void;
  /** Records what a layout actually placed, so nothing goes missing silently. */
  markRendered?: (name: string) => void;
  mode: "create" | "edit";
  /**
   * Where the record sits in the lifecycle.
   *
   * `status` and `publishedAt` are values, not fields: they are absent from the
   * form schema, and the only thing that moves them is the publish action -
   * the one the list's row button runs. `transition` is that same action from
   * inside the form, so the edit page can offer "Publish" / "Convert to draft"
   * beside "Save changes", and the create form can publish right after the
   * create. Both are shown only when `canPublish` allows it.
   */
  publication: {
    /** Whether the current admin holds `can_publish` for this content type. */
    canPublish: boolean;
    enabled: boolean;
    publishedAt?: unknown;
    status?: unknown;
    /**
     * Publishes or unpublishes the record being edited. Resolves `true` when
     * the record moved. `undefined` while creating - there is nothing to move.
     */
    transition?: (action: "publish" | "unpublish") => Promise<boolean>;
  };
  /** The content type's singular label, for confirmations and toasts. */
  singular: string;
  /** The record's resolved title while editing, for confirmations and toasts. */
  title?: string;
}

const ContentFormContext = React.createContext<ContentFormContextValue | null>(
  null,
);

/**
 * The state a custom layout reads, from inside the one `AutoForm` instance.
 *
 * Context rather than props, and that is the whole architecture decision: a
 * layout is a client component *referenced* from `config.tsx`, which is a server
 * module, so anything handed to it as a prop crosses an RSC boundary. Rendered
 * field elements and a `renderField(name)` callback cannot cross one - the first
 * is not serialisable and the second is a server closure. Both are perfectly
 * ordinary values on the client, where the provider and the layout both run.
 */
export const useContentForm = (): ContentFormContextValue => {
  const value = React.use(ContentFormContext);

  if (!value) {
    throw new Error(
      "useContentForm must be used inside a Content Engine form layout.",
    );
  }

  return value;
};

/**
 * Same value, but `null` outside a layout.
 *
 * For a primitive that is legitimately optional - `ContentFormActions` is used
 * by layouts only, but a field component may be reused in a plain dialog.
 */
export const useContentFormOptional = (): ContentFormContextValue | null =>
  React.use(ContentFormContext);

export const ContentFormProvider = ({
  children,
  value,
}: {
  children: React.ReactNode;
  value: Omit<ContentFormContextValue, "markHeaderRendered" | "markRendered">;
}) => {
  /**
   * Every field a layout has placed, cumulative for the life of the form.
   *
   * Never emptied, and that is the point: the question this answers is "did the
   * layout ever ask for this field", not "did it ask on this particular render".
   * Clearing it per render is what the first version did, and it could not be
   * made to work either way round - during render it is a write React forbids,
   * and in the effect it depends on there being exactly one effect run per
   * render. There is not: Strict Mode, which every Next dev server enables, runs
   * them twice on mount, so the second pass always found an empty set and
   * reported every field on the screen as missing.
   */
  const renderedRef = React.useRef<Set<string>>(new Set());
  const headerRenderedRef = React.useRef(false);

  const markRendered = React.useCallback((name: string) => {
    renderedRef.current.add(name);
  }, []);

  const markHeaderRendered = React.useCallback(() => {
    headerRenderedRef.current = true;
  }, []);

  const { fieldNames, header } = value;

  /**
   * A layout that forgets a field silently drops it from the payload, which is
   * the one failure mode this API has that the generated form does not. Saying
   * so in development costs nothing and turns a data-loss bug into a console
   * line naming the field.
   *
   * Runs after the children, which is what makes the set complete.
   */
  React.useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    // eslint-disable-next-line react-you-might-not-need-an-effect/no-pass-data-to-parent -- nothing leaves this component; the effect is where it has to be computed, because what it compares against is what the children recorded while rendering
    const missing = fieldNames.filter(name => !renderedRef.current.has(name));

    // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler -- the only consumer of `missing` is the `console.warn` below
    if (missing.length > 0) {
      // eslint-disable-next-line no-console -- development-only diagnostic
      console.warn(
        `[vitnode] Content form layout did not render: ${missing.join(", ")}. Add <ContentFormField name="..." /> for each, or remove them from admin.form.fields.`,
      );
    }

    // A page without its heading has no title, no back link and - when the
    // layout also skipped `ContentFormActions` - no way to save. Same failure
    // shape as a forgotten field, same treatment.
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler -- the only consumer is the `console.warn` below, and it has to run after the children rendered
    if (header && !headerRenderedRef.current) {
      // eslint-disable-next-line no-console -- development-only diagnostic
      console.warn(
        "[vitnode] Content form layout did not render <ContentFormHeader />. A page-mode layout places the heading and the back link itself - add it, with <ContentFormActions /> inside if the submit buttons belong beside them.",
      );
    }
  });

  return (
    <ContentFormContext.Provider
      value={{ ...value, markHeaderRendered, markRendered }}
    >
      {children}
    </ContentFormContext.Provider>
  );
};
