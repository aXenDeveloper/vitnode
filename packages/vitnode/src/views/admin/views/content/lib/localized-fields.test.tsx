import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ContentFormSpec } from "@/content/admin/spec";

import { AutoForm } from "@/components/form/auto-form";
import { LanguagesProvider } from "@/components/languages-provider";
import {
  buildFormSchemaFromSpec,
  contentFormInitialValues,
  contentFormValuesToPayload,
  contentFormValuesToTranslations,
} from "@/content/admin/spec";

import { ContentField } from "./field-component";

/**
 * The reader is on Polish, which is the whole premise: every localized input
 * has to open in the language the person is already using VitNode in, without
 * anybody choosing it and without `localization.defaultLocale` ("en") having a
 * say in what is *displayed*.
 */
vi.mock("next-intl", () => ({
  useLocale: () => "pl",
  useTranslations: () => (key: string) => key,
}));

// Pulled in transitively by the field components, and it builds a real
// next-intl router at module scope.
vi.mock("@/lib/navigation", () => ({
  Link: () => null,
  usePathname: () => "",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "pl", name: "Polski" },
];

/** Blog Article, reduced to the shape that matters here. */
const SPEC: ContentFormSpec = {
  contentTypeId: "blog.post",
  defaultLocale: "en",
  fields: [
    {
      kind: "text",
      label: "Title",
      localized: true,
      maxLength: 255,
      minLength: 3,
      name: "title",
      nullable: false,
      required: true,
    },
    {
      kind: "slug",
      label: "Friendly URL",
      localized: true,
      maxLength: 255,
      name: "friendlyUrl",
      nullable: false,
      required: false,
    },
    {
      kind: "textarea",
      label: "Content",
      localized: true,
      name: "content",
      nullable: false,
      required: true,
    },
    {
      kind: "text",
      label: "Color",
      name: "color",
      nullable: true,
      required: false,
    },
  ],
  pluginId: "@vitnode/blog",
  titleField: "title",
};

const TRANSLATIONS = [
  {
    locale: "en",
    values: {
      content: "English body",
      friendlyUrl: "hello-world",
      title: "Hello world",
    },
  },
  {
    locale: "pl",
    values: {
      content: "Polska treść",
      friendlyUrl: "witaj-swiecie",
      title: "Witaj świecie",
    },
  },
];

const Harness = ({
  data,
  onSubmit = vi.fn(),
  translations = TRANSLATIONS,
}: {
  data?: Record<string, unknown> & { id: number };
  onSubmit?: (values: Record<string, unknown>) => void;
  translations?: { locale: string; values: Record<string, unknown> }[];
}) => {
  const values = contentFormInitialValues(SPEC, data, translations);

  return (
    <LanguagesProvider languages={LANGUAGES}>
      <AutoForm
        fields={SPEC.fields.map(fieldSpec => ({
          id: fieldSpec.name,

          component: props => (
            <ContentField
              loadOptions={async () => await Promise.resolve([])}
              spec={fieldSpec}
              {...props}
            />
          ),
        }))}
        formSchema={buildFormSchemaFromSpec(SPEC, values)}
        onSubmit={onSubmit}
        submitButtonProps={{ children: "Save" }}
      />
    </LanguagesProvider>
  );
};

/** The input of one labelled field, whatever kind of control it turned out to be. */
const fieldBox = (label: string): HTMLElement =>
  screen.getByLabelText(label, { exact: false });

/** That field's own language switcher - the one inside its own row. */
const switcherFor = (label: string): HTMLElement => {
  const control = fieldBox(label);
  const group = control.closest("[data-slot='field']") ?? control.parentElement;

  return within(group as HTMLElement).getByRole("combobox");
};

/**
 * Presses Save once react-hook-form has actually validated.
 *
 * The button is disabled until then - exactly as it is for a person, who cannot
 * click it any sooner either.
 */
const save = async () => {
  const button = screen.getByRole("button", { name: "submit" });
  await waitFor(() => {
    expect(button.getAttribute("disabled")).toBeNull();
  });
  fireEvent.click(button);
};

const switchTo = async (label: string, name: string) => {
  fireEvent.click(switcherFor(label));
  const option = await screen.findByRole("option", { name });
  fireEvent.pointerDown(option);
  fireEvent.click(option);
};

describe("localized fields in a Content Engine form", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders no locale tabs of any kind", () => {
    render(<Harness data={{ color: "#fff", id: 7 }} />);

    // No `Shared | English | Polish` strip, and nothing that behaves like one.
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
  });

  it("opens every localized field in the reader's own language", () => {
    render(<Harness data={{ color: "#fff", id: 7 }} />);

    // `localization.defaultLocale` is `en`; the reader is on `pl`. Display
    // follows the reader.
    expect(fieldBox("Title").getAttribute("value")).toBe("Witaj świecie");
    expect((fieldBox("Content") as HTMLTextAreaElement).value).toBe(
      "Polska treść",
    );
    expect(fieldBox("Friendly URL").getAttribute("value")).toBe(
      "witaj-swiecie",
    );
  });

  it("puts a shared field in the same form, with no switcher of its own", () => {
    render(<Harness data={{ color: "#3260c0", id: 7 }} />);

    expect(fieldBox("Color").getAttribute("value")).toBe("#3260c0");
    expect(() => switcherFor("Color")).toThrow();
  });

  it("switches one field's language without moving any other", async () => {
    // The critical regression: there is no form-global locale, so `Title` can be
    // read in English while the body and the URL stay Polish.
    render(<Harness data={{ color: "#fff", id: 7 }} />);

    await switchTo("Title", "English");

    await waitFor(() => {
      expect(fieldBox("Title").getAttribute("value")).toBe("Hello world");
    });
    expect((fieldBox("Content") as HTMLTextAreaElement).value).toBe(
      "Polska treść",
    );
    expect(fieldBox("Friendly URL").getAttribute("value")).toBe(
      "witaj-swiecie",
    );
  });

  it("edits only the language the field is showing", async () => {
    const onSubmit = vi.fn();
    render(<Harness data={{ color: "#fff", id: 7 }} onSubmit={onSubmit} />);

    fireEvent.change(fieldBox("Title"), { target: { value: "Nowy tytuł" } });
    await save();

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });

    const values = onSubmit.mock.calls[0][0] as Record<string, unknown>;
    const byLocale = contentFormValuesToTranslations(SPEC, values);

    expect(byLocale.pl).toMatchObject({ title: "Nowy tytuł" });
    // English is untouched, which is what keeps its version, its revision and
    // its cache exactly where they were.
    expect(byLocale.en).toMatchObject({ title: "Hello world" });
  });

  it("never invents a translation for a language nobody typed into", async () => {
    const onSubmit = vi.fn();
    render(
      <Harness
        data={{ color: "#fff", id: 7 }}
        onSubmit={onSubmit}
        translations={[TRANSLATIONS[0]]}
      />,
    );

    // Switch a field to Polish, look at the empty box, and save.
    await switchTo("Title", "Polski");
    await waitFor(() => {
      expect(fieldBox("Title").getAttribute("value")).toBe("");
    });
    fireEvent.click(screen.getByRole("button", { name: "submit" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });

    const values = onSubmit.mock.calls[0][0] as Record<string, unknown>;

    expect(Object.keys(contentFormValuesToTranslations(SPEC, values))).toEqual([
      "en",
    ]);
  });

  it("keeps localized values out of the shared payload", async () => {
    const onSubmit = vi.fn();
    render(<Harness data={{ color: "#3260c0", id: 7 }} onSubmit={onSubmit} />);

    fireEvent.change(fieldBox("Color"), { target: { value: "#000000" } });
    await save();

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });

    const payload = contentFormValuesToPayload(
      SPEC,
      onSubmit.mock.calls[0][0] as Record<string, unknown>,
    );

    // The base row gets the base row's fields, and nothing per-language leaks
    // into it - the translation tables are still where translations live.
    expect(payload).toEqual({ color: "#000000" });
  });
});
