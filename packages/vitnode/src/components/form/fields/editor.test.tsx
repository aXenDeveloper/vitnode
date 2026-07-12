import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type FieldValues, useForm } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LanguagesProvider } from "@/components/languages-provider";
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

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "pl", name: "Polski" },
];

const MultiLangHarness = ({
  onSubmit = vi.fn(),
  defaultValue,
  languages = LANGUAGES,
}: {
  defaultValue?: unknown;
  languages?: { code: string; name: string }[];
  onSubmit?: (values: FieldValues) => void;
}) => {
  const form = useForm({
    defaultValues: { content: defaultValue } as FieldValues,
  });

  return (
    <LanguagesProvider languages={languages}>
      <Form form={form} onSubmit={onSubmit}>
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <AutoFormEditor
              field={field}
              label="Content"
              multiLang
              otherProps={{ isOptional: false }}
            />
          )}
        />
        <button type="submit">submit</button>
      </Form>
    </LanguagesProvider>
  );
};

describe("AutoFormEditor multiLang", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the language select when more than one language is enabled", () => {
    render(<MultiLangHarness />);

    expect(screen.getByRole("combobox")).toBeDefined();
  });

  it("does not render the language select for a single language", () => {
    render(<MultiLangHarness languages={[{ code: "en", name: "English" }]} />);

    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("writes editor content as a { languageCode, value }[] array", async () => {
    const onSubmit = vi.fn();
    render(<MultiLangHarness onSubmit={onSubmit} />);

    fireEvent.change(screen.getByTestId("editor"), {
      target: { value: "<p>Hello</p>" },
    });
    fireEvent.click(screen.getByRole("button", { name: "submit" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        { content: [{ languageCode: "en", value: "<p>Hello</p>" }] },
        expect.anything(),
      );
    });
  });

  it("swaps the edited value per language without touching others", async () => {
    const onSubmit = vi.fn();
    render(
      <MultiLangHarness
        defaultValue={[
          { languageCode: "en", value: "<p>Hello</p>" },
          { languageCode: "pl", value: "<p>Cześć</p>" },
        ]}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByTestId<HTMLTextAreaElement>("editor").value).toBe(
      "<p>Hello</p>",
    );

    fireEvent.click(screen.getByRole("combobox"));
    const option = await screen.findByRole("option", { name: "Polski" });
    fireEvent.pointerDown(option);
    fireEvent.click(option);

    await waitFor(() => {
      expect(screen.getByTestId<HTMLTextAreaElement>("editor").value).toBe(
        "<p>Cześć</p>",
      );
    });

    fireEvent.change(screen.getByTestId("editor"), {
      target: { value: "<p>Hej</p>" },
    });
    fireEvent.click(screen.getByRole("button", { name: "submit" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        {
          content: [
            { languageCode: "en", value: "<p>Hello</p>" },
            { languageCode: "pl", value: "<p>Hej</p>" },
          ],
        },
        expect.anything(),
      );
    });
  });
});
