import React from "react";

import type { PageTitleBack } from "@/components/ui/page-title";
import type { ContentFileFieldValue } from "@/content/files";
import type { ContentId } from "@/content/ids";
import type { ContentVisibilityAction } from "@/content/visibility";

export interface ContentFormHeaderValue {
  back: PageTitleBack;
  desc?: React.ReactNode;
  title: React.ReactNode;
}

export interface ContentFormTranslationMeta {
  locale: string;
  status?: string;
  updatedAt?: null | string;
}

/**
 * What a custom content form layout (`contentTypeAdmin({ forms })`) reads
 * through {@link useContentForm}: the rendered field inputs, the form mode and
 * the publication/visibility state of the record being edited.
 */
export interface ContentFormContextValue {
  /** The content type's `localization.defaultLocale`, when localized. */
  defaultLocale?: null | string;
  /** Every field the form renders, in order (`admin.form.fields` or sections). */
  fieldNames: string[];
  /** The ready-to-render input of each field, by name. Prefer `<ContentFormField>`. */
  fields: Record<string, React.ReactNode>;
  files?: Record<string, ContentFileFieldValue | undefined>;
  header?: ContentFormHeaderValue;
  localizedFieldNames: string[];
  /**
   * Records that the layout placed the header. In development the form warns
   * when a page-mode layout never renders `<ContentFormHeader>`.
   */
  markHeaderRendered?: () => void;
  /**
   * Records that the layout placed a field. In development the form warns
   * about fields no layout rendered. The provided primitives call it for you.
   */
  markRendered?: (name: string) => void;
  mode: "create" | "edit";
  onSaved?: (
    listener: (saved: { itemId: ContentId }) => Promise<void> | void,
  ) => () => void;
  publication: {
    canPublish: boolean;
    enabled: boolean;
    publishedAt?: unknown;
    status?: unknown;
    transition?: (action: "publish" | "unpublish") => Promise<boolean>;
  };
  /** The content type's singular noun, already translated. */
  singular: string;
  /** `true` while the layout renders as a loading placeholder. */
  skeleton?: boolean;
  title?: string;
  translations?: readonly ContentFormTranslationMeta[];
  visibility?: {
    canHide: boolean;
    enabled: boolean;
    hiddenAt?: unknown;
    transition?: (action: ContentVisibilityAction) => Promise<boolean>;
  };
}

const ContentFormContext = React.createContext<ContentFormContextValue | null>(
  null,
);

/**
 * The surrounding Content Engine form, for custom layouts and field components.
 *
 * @throws When called outside a Content Engine form layout. Use
 * {@link useContentFormOptional} for components that also render elsewhere.
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

/** Like {@link useContentForm}, but `null` outside a Content Engine form. */
export const useContentFormOptional = (): ContentFormContextValue | null =>
  React.use(ContentFormContext);

export const ContentFormProvider = ({
  children,
  value,
}: {
  children: React.ReactNode;
  value: Omit<ContentFormContextValue, "markHeaderRendered" | "markRendered">;
}) => {
  const renderedRef = React.useRef<Set<string>>(new Set());
  const headerRenderedRef = React.useRef(false);

  const markRendered = React.useCallback((name: string) => {
    renderedRef.current.add(name);
  }, []);

  const markHeaderRendered = React.useCallback(() => {
    headerRenderedRef.current = true;
  }, []);

  const { fieldNames, header, skeleton } = value;

  React.useEffect(() => {
    // oxlint-disable-next-line react-you-might-not-need-an-effect/no-event-handler -- the placeholder renders whatever the layout asks for, so there is nothing to warn about
    if (process.env.NODE_ENV === "production" || skeleton) return;

    // oxlint-disable-next-line react-you-might-not-need-an-effect/no-pass-data-to-parent -- nothing leaves this component; the effect is where it has to be computed, because what it compares against is what the children recorded while rendering
    const missing = fieldNames.filter(name => !renderedRef.current.has(name));

    // oxlint-disable-next-line react-you-might-not-need-an-effect/no-event-handler -- the only consumer of `missing` is the `console.warn` below
    if (missing.length > 0) {
      // oxlint-disable-next-line no-console -- development-only diagnostic
      console.warn(
        `[vitnode] Content form layout did not render: ${missing.join(", ")}. Add <ContentFormField name="..." /> for each, or remove them from admin.form.fields.`,
      );
    }

    // A page without its heading has no title, no back link and - when the
    // layout also skipped `ContentFormActions` - no way to save. Same failure
    // shape as a forgotten field, same treatment.
    // oxlint-disable-next-line react-you-might-not-need-an-effect/no-event-handler -- the only consumer is the `console.warn` below, and it has to run after the children rendered
    if (header && !headerRenderedRef.current) {
      // oxlint-disable-next-line no-console -- development-only diagnostic
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
