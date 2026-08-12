import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type FieldValues, useForm } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { InputParams } from "@/lib/helpers/auto-form";

import { LanguagesProvider } from "@/components/languages-provider";
import { Form, FormField } from "@/components/ui/form";

import { AutoFormTextarea } from "./textarea";

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
  multiLang = true,
}: {
  defaultValue?: unknown;
  itemParams?: InputParams;
  languages?: { code: string; enabled?: boolean; name: string }[];
  multiLang?: boolean;
  onSubmit?: (values: FieldValues) => void;
}) => {
  const form = useForm({
    defaultValues: { body: defaultValue } as FieldValues,
  });

  return (
    <LanguagesProvider languages={languages}>
      <Form form={form} onSubmit={onSubmit}>
        <FormField
          control={form.control}
          name="body"
          render={({ field }) => (
            <AutoFormTextarea
              field={field}
              itemParams={itemParams}
              label="Body"
              multiLang={multiLang}
              otherProps={{ isOptional: false }}
            />
          )}
        />
        <button type="submit">submit</button>
      </Form>
    </LanguagesProvider>
  );
};

describe("AutoFormTextarea multiLang", () => {
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

    expect(screen.getByRole("combobox")).toBeDefined();
  });

  it("shows no selector on a one-language install", () => {
    // A switcher with one option is a control that cannot do anything.
    render(<Harness languages={[{ code: "en", name: "English" }]} />);

    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("shows none for a shared field either", () => {
    render(<Harness multiLang={false} />);

    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("starts on the reader's own language", () => {
    render(
      <Harness
        defaultValue={[
          { languageCode: "pl", value: "Cześć" },
          { languageCode: "en", value: "Hello" },
        ]}
      />,
    );

    // `useLocale()` is `en`, and `en` is second in the stored array - so this is
    // the reader's language rather than whatever happened to be written first.
    expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe(
      "Hello",
    );
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
        { body: [{ languageCode: "en", value: "Hello" }] },
        expect.anything(),
      );
    });
  });

  it("keeps a value per language, and restores it on the way back", async () => {
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

    const switchTo = async (name: string) => {
      fireEvent.click(screen.getByRole("combobox"));
      const option = await screen.findByRole("option", { name });
      fireEvent.pointerDown(option);
      fireEvent.click(option);
    };

    await switchTo("Polski");
    await waitFor(() => {
      expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe(
        "Cześć",
      );
    });

    await switchTo("English");
    await waitFor(() => {
      expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe(
        "Hello",
      );
    });
  });

  it("shows an empty box for a language with no translation, and writes nothing", async () => {
    const onSubmit = vi.fn();
    render(
      <Harness
        defaultValue={[{ languageCode: "en", value: "Hello" }]}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole("combobox"));
    const option = await screen.findByRole("option", { name: "Polski" });
    fireEvent.pointerDown(option);
    fireEvent.click(option);

    await waitFor(() => {
      expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe("");
    });

    fireEvent.click(screen.getByRole("button", { name: "submit" }));

    // Looking at a language is not a decision to create a translation in it.
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        { body: [{ languageCode: "en", value: "Hello" }] },
        expect.anything(),
      );
    });
  });

  it("applies the value maxLength from itemParams to the textarea", () => {
    render(<Harness itemParams={{ value: { maxLength: 12 } }} />);

    expect(screen.getByRole("textbox").getAttribute("maxLength")).toBe("12");
  });
});
