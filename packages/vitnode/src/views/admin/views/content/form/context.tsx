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
  fieldNames: string[];
  fields: Record<string, React.ReactNode>;
  header?: ContentFormHeaderValue;
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
  const renderedRef = React.useRef<Set<string>>(new Set());
  const headerRenderedRef = React.useRef(false);

  const markRendered = React.useCallback((name: string) => {
    renderedRef.current.add(name);
  }, []);

  const markHeaderRendered = React.useCallback(() => {
    headerRenderedRef.current = true;
  }, []);

  const { fieldNames, header } = value;

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
