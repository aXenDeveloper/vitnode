// No "use client" here on purpose: this module is only reached from
// `content-form`, which is already a client entry.
// Declaring it again would make it a nested client entry, and `next/dynamic`
// cannot resolve one from inside a published package.
import React from "react";

import type {
  HeaderContentBack,
  HeaderContentBackLinkComponent,
} from "@/components/ui/header-content";

export interface ContentFormHeaderValue {
  back: HeaderContentBack;
  desc?: React.ReactNode;
  title: React.ReactNode;
}

export type ContentFormLinkComponent = HeaderContentBackLinkComponent;

export interface ContentFormContextValue {
  fieldNames: string[];
  fields: Record<string, React.ReactNode>;
  header?: ContentFormHeaderValue;

  LinkComponent: ContentFormLinkComponent;
  localizedFieldNames: string[];
  markHeaderRendered?: () => void;
  markRendered?: (name: string) => void;
  mode: "create" | "edit";
  publication: {
    canPublish: boolean;
    enabled: boolean;
    publishedAt?: unknown;
    status?: unknown;
    transition?: (action: "publish" | "unpublish") => Promise<boolean>;
  };
  singular: string;
  skeleton?: boolean;
  title?: string;
}

const ContentFormContext = React.createContext<ContentFormContextValue | null>(
  null,
);

export const useContentForm = (): ContentFormContextValue => {
  const value = React.use(ContentFormContext);

  if (!value) {
    throw new Error(
      "useContentForm must be used inside a Content Engine form layout.",
    );
  }

  return value;
};

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
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler -- the placeholder renders whatever the layout asks for, so there is nothing to warn about
    if (process.env.NODE_ENV === "production" || skeleton) return;

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
