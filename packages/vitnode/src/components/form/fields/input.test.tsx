import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type FieldValues, useForm } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { InputParams } from "@/lib/helpers/auto-form";

import { LanguagesProvider } from "@/components/languages-provider";
import { Form, FormField } from "@/components/ui/form";

import { AutoFormInput } from "./input";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "pl", name: "Polski" },
];

const Harness = ({
  onSubmit = vi.fn(),
  defaultValue,
  languages = LANGUAGES,
  itemParams,
}: {
  defaultValue?: unknown;
  itemParams?: InputParams;
  languages?: { code: string; enabled?: boolean; name: string }[];
  onSubmit?: (values: FieldValues) => void;
}) => {
  const form = useForm({
    defaultValues: { name: defaultValue } as FieldValues,
  });

  return (
    <LanguagesProvider languages={languages}>
      <Form form={form} onSubmit={onSubmit}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <AutoFormInput
              field={field}
              itemParams={itemParams}
              label="Name"
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

describe("AutoFormInput multiLang", () => {
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
    render(<Harness />);

    expect(screen.getByText("Name")).toBeDefined();
    expect(screen.getByRole("combobox")).toBeDefined();
  });

  it("does not render the language select for a single language", () => {
    render(<Harness languages={[{ code: "en", name: "English" }]} />);

    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("filters out a disabled language so it is not selectable", () => {
    // `pl` is disabled, leaving only `en` selectable - so the select, which
    // only appears with more than one language, is not rendered.
    render(
      <Harness
        languages={[
          { code: "en", name: "English" },
          { code: "pl", enabled: false, name: "Polski" },
        ]}
      />,
    );

    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("writes the typed value as a { languageCode, value }[] array", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Hello" },
    });
    fireEvent.click(screen.getByRole("button", { name: "submit" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        { name: [{ languageCode: "en", value: "Hello" }] },
        expect.anything(),
      );
    });
  });

  it("shows the selected language's value and edits only that language", async () => {
    const onSubmit = vi.fn();
    render(
      <Harness
        defaultValue={[
          { languageCode: "en", value: "Hello" },
          { languageCode: "pl", value: "Cześć" },
        ]}
        onSubmit={onSubmit}
      />,
    );

    const input = screen.getByRole<HTMLInputElement>("textbox");
    expect(input.value).toBe("Hello");

    // Switch the per-input language to Polski.
    fireEvent.click(screen.getByRole("combobox"));
    const option = await screen.findByRole("option", { name: "Polski" });
    fireEvent.pointerDown(option);
    fireEvent.click(option);

    await waitFor(() => {
      expect(screen.getByRole<HTMLInputElement>("textbox").value).toBe("Cześć");
    });

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Hej" },
    });
    fireEvent.click(screen.getByRole("button", { name: "submit" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        {
          name: [
            { languageCode: "en", value: "Hello" },
            { languageCode: "pl", value: "Hej" },
          ],
        },
        expect.anything(),
      );
    });
  });

  it("applies the value maxLength from itemParams to the input", () => {
    render(<Harness itemParams={{ value: { maxLength: 10 } }} />);

    expect(screen.getByRole("textbox").getAttribute("maxLength")).toBe("10");
  });
});
