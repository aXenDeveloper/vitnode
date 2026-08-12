// No "use client" here on purpose: this module is only reached from
// `content-form`, which is already a client entry.
// Declaring it again would make it a nested client entry, and `next/dynamic`
// cannot resolve one from inside a published package.
import React from "react";

export interface ContentFormContextValue {
  /** Every field of the form, in declaration order. */
  fieldNames: string[];
  /** Every field, already rendered and keyed by name. */
  fields: Record<string, React.ReactNode>;
  /**
   * Which of them hold one value per language.
   *
   * Informational, for a layout that wants to group or annotate them. A layout
   * does **not** need it to place a field: a localized input renders its own
   * language switcher, so `<ContentFormField name="title" />` works wherever it
   * is put, whichever table the value ends up on.
   */
  localizedFieldNames: string[];
  /** Records what a layout actually placed, so nothing goes missing silently. */
  markRendered?: (name: string) => void;
  mode: "create" | "edit";
  /**
   * Where the record sits in the lifecycle, read-only.
   *
   * Values rather than controls: `status` and `publishedAt` are not in the form
   * schema, and the publish action on the list is the one thing that moves them.
   */
  publication: {
    enabled: boolean;
    publishedAt?: unknown;
    status?: unknown;
  };
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
  const value = React.useContext(ContentFormContext);

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
  React.useContext(ContentFormContext);

export const ContentFormProvider = ({
  children,
  value,
}: {
  children: React.ReactNode;
  value: Omit<ContentFormContextValue, "markRendered">;
}) => {
  const rendered = React.useRef<Set<string>>(new Set());

  const markRendered = React.useCallback((name: string) => {
    rendered.current.add(name);
  }, []);

  const { fieldNames } = value;

  /**
   * A layout that forgets a field silently drops it from the payload, which is
   * the one failure mode this API has that the generated form does not. Saying
   * so in development costs nothing and turns a data-loss bug into a console
   * line naming the field.
   *
   * Runs after the children, which is what makes the set complete - and clears
   * it afterwards, so a layout that *stops* placing a field is noticed on the
   * very next render rather than remembered as still placing it.
   */
  React.useEffect(() => {
    const missing = fieldNames.filter(name => !rendered.current.has(name));
    rendered.current.clear();

    if (process.env.NODE_ENV === "production" || missing.length === 0) return;

    // eslint-disable-next-line no-console -- development-only diagnostic
    console.warn(
      `[vitnode] Content form layout did not render: ${missing.join(", ")}. Add <ContentFormField name="..." /> for each, or remove them from admin.form.fields.`,
    );
  });

  return (
    <ContentFormContext.Provider value={{ ...value, markRendered }}>
      {children}
    </ContentFormContext.Provider>
  );
};
