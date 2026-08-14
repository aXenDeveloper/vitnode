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

const Harness = ({ spec }: { spec: ContentFormFieldSpec }) => {
  const form = useForm({ defaultValues: { value: undefined } as FieldValues });

  return (
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
              isOptional: !spec.required,
            }}
            spec={spec}
          />
        )}
      />
    </Form>
  );
};

const renderField = (overrides: Partial<ContentFormFieldSpec>) =>
  render(
    <Harness
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
});
