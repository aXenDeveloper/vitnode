import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type FieldValues, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { Form, FormField } from "@/components/ui/form";

import { AutoFormEditor } from "./editor";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/components/ui/editor", () => ({
  Editor: ({
    value,
    onChange,
    onBlur,
    ...props
  }: {
    onBlur?: () => void;
    onChange?: (value: string) => void;
    value?: string;
  }) => (
    <textarea
      data-testid="editor"
      onBlur={onBlur}
      onChange={e => onChange?.(e.target.value)}
      value={value}
      {...props}
    />
  ),
}));

const Harness = ({
  onSubmit = vi.fn(),
  defaultValue = "<p>init</p>",
}: {
  defaultValue?: string;
  onSubmit?: (values: FieldValues) => void;
}) => {
  const form = useForm({
    defaultValues: { content: defaultValue } as FieldValues,
  });

  return (
    <Form form={form} onSubmit={onSubmit}>
      <FormField
        control={form.control}
        name="content"
        render={({ field }) => (
          <AutoFormEditor
            description="Rich text content"
            field={field}
            label="Content"
            otherProps={{ isOptional: false }}
          />
        )}
      />
      <button type="submit">submit</button>
    </Form>
  );
};

describe("AutoFormEditor", () => {
  it("renders label and description", () => {
    render(<Harness />);

    expect(screen.getByText("Content")).toBeDefined();
    expect(screen.getByText("Rich text content")).toBeDefined();
  });

  it("passes the field value as the editor initial value", () => {
    render(<Harness defaultValue="<p>hello</p>" />);

    expect(screen.getByTestId<HTMLTextAreaElement>("editor").value).toBe(
      "<p>hello</p>",
    );
  });

  it("wires the editor onChange back into the form value", () => {
    render(<Harness />);
    const editor = screen.getByTestId<HTMLTextAreaElement>("editor");

    fireEvent.change(editor, { target: { value: "<p>updated</p>" } });

    expect(editor.value).toBe("<p>updated</p>");
  });

  it("submits the current editor content", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const editor = screen.getByTestId<HTMLTextAreaElement>("editor");

    fireEvent.change(editor, { target: { value: "<p>final</p>" } });
    fireEvent.click(screen.getByRole("button", { name: "submit" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        { content: "<p>final</p>" },
        expect.anything(),
      );
    });
  });

  it("applies the form control aria/id attributes to the editor", () => {
    render(<Harness />);
    const editor = screen.getByTestId("editor");

    expect(editor.getAttribute("id")).toMatch(/-form-item$/);
    expect(editor.getAttribute("aria-invalid")).toBe("false");
  });
});
