import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { type FieldValues, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import type { ContentFormFieldSpec } from "@/content/admin/spec";

import { Form, FormField } from "@/components/ui/form";

import { ContentField } from "./field-component";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));
// The people picker ships a default lookup that reaches the server. Nothing here
// uses it - every field is handed a `loadOptions` - but the import is real, and
// `@/lib/fetcher` is `server-only`.
vi.mock("@/components/form/fields/search-users.action.server", () => ({
  searchUsers: vi.fn(),
}));

const Harness = ({
  isOptional,
  spec,
}: {
  /** What `AutoForm` inferred - which the field is expected to overrule. */
  isOptional?: boolean;
  spec: ContentFormFieldSpec;
}) => {
  const form = useForm({ defaultValues: { value: undefined } as FieldValues });

  return (
    // A `relation` renders the async combobox, which fetches through TanStack
    // Query - so the harness provides a client the way the real AdminCP layout
    // does.
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <Form form={form} onSubmit={vi.fn()}>
        <FormField
          control={form.control}
          name="value"
          render={({ field }) => (
            <ContentField
              field={field}
              loadOptions={async () => await Promise.resolve([])}
              otherProps={{
                enum: spec.options?.map(option => option.value),
                isOptional: isOptional ?? !spec.required,
              }}
              spec={spec}
            />
          )}
        />
      </Form>
    </QueryClientProvider>
  );
};

const renderField = (
  overrides: Partial<ContentFormFieldSpec>,
  isOptional?: boolean,
) =>
  render(
    <Harness
      isOptional={isOptional}
      spec={{
        kind: "text",
        label: "Label",
        name: "value",
        nullable: false,
        required: true,
        ...overrides,
      }}
    />,
  );

describe("ContentField", () => {
  it("renders a text field as a text input", () => {
    const { container } = renderField({ kind: "text" });

    expect(container.querySelector('input[type="text"]')).not.toBeNull();
  });

  it("renders a textarea field as a textarea", () => {
    const { container } = renderField({ kind: "textarea" });

    expect(container.querySelector("textarea")).not.toBeNull();
  });

  it("renders a number field as a number input", () => {
    const { container } = renderField({ integer: true, kind: "number" });

    expect(container.querySelector('input[type="number"]')).not.toBeNull();
  });

  it("renders a nullable number with its clear toggle", () => {
    renderField({ integer: true, kind: "number", nullable: true });

    expect(screen.getByRole("checkbox")).toBeTruthy();
  });

  it("renders a boolean field as a switch", () => {
    renderField({ kind: "boolean" });

    expect(screen.getByRole("switch")).toBeTruthy();
  });

  it("renders a dateTime field as a datetime-local input", () => {
    const { container } = renderField({ kind: "dateTime" });

    expect(
      container.querySelector('input[type="datetime-local"]'),
    ).not.toBeNull();
  });

  it("renders an enum field as a select by default", () => {
    renderField({
      kind: "enum",
      options: [{ label: "Draft", value: "draft" }],
    });

    expect(screen.getByRole("combobox")).toBeTruthy();
  });

  it("renders an enum field as a radio group when asked", () => {
    renderField({
      display: "radio",
      kind: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Published", value: "published" },
      ],
    });

    expect(screen.getAllByRole("radio").length).toBe(2);
  });

  it("shows the field label", () => {
    renderField({ kind: "text", label: "Published at" });

    expect(screen.getByText("Published at")).toBeTruthy();
  });

  it("renders a to-many user field as a multi-select, not one picker", () => {
    const { container } = renderField({
      kind: "user",
      label: "Authors",
      multiple: true,
    });

    // The chips composition, which is what `multiple` means everywhere in the
    // AdminCP - rather than the single people picker a `multiple` field used to
    // fall back to when nothing branched on it.
    expect(
      container.querySelector("[data-slot='combobox-chips']"),
    ).toBeTruthy();
  });

  /**
   * Both directions of the same mistake, and both are what `AutoForm` actually
   * infers: a `relation` is a `{ label, value }` object, so the params walker
   * descends into it and loses the field's own `required`; and an edit form
   * gives every field a Zod default, which puts an optional one *in* `required`.
   * The spec is the only thing that knows, so it is the only thing asked.
   */
  it("marks a required field required, whatever the schema inferred", () => {
    renderField({ kind: "relation", label: "Category", required: true }, true);

    expect(screen.queryByText("optional")).toBeNull();
  });

  it("marks a field with a minimum of one required, not optional", () => {
    // A to-many field can never be `required` - the empty set is always
    // storable - so `min: 1` is the only way it says "you have to choose
    // something", and a label that still read "(optional)" would contradict the
    // schema that rejects an empty one.
    renderField(
      {
        kind: "relation",
        label: "Categories",
        minItems: 1,
        multiple: true,
        required: false,
      },
      true,
    );

    expect(screen.queryByText("optional")).toBeNull();
  });

  it("marks an optional field optional, whatever the schema inferred", () => {
    renderField(
      { kind: "slug", label: "Friendly URL", required: false },
      false,
    );

    expect(screen.getByText("optional")).toBeTruthy();
  });
});
