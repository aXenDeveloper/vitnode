import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { ContentFormSectionSpec } from "@/content/admin/spec";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormInput } from "@/components/form/fields/input";

import { ContentFormProvider } from "./context";
import { ContentFormSections } from "./sections";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/navigation", () => ({
  Link: ({
    children,
    ...props
  }: React.ComponentProps<"a"> & { children: React.ReactNode }) => (
    <a {...props}>{children}</a>
  ),
  usePathname: () => "/admin/content/blog/post",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const schema = z.object({
  category: z.string().default("Reference"),
  content: z.string().default("Body"),
  title: z.string().min(1).default("Hello"),
});

const SECTIONS: ContentFormSectionSpec[] = [
  {
    desc: "Main content details",
    fields: ["title", "content"],
    name: "general",
    title: "General",
  },
  { fields: ["category"], name: "meta", title: "Metadata" },
];

/**
 * The generated layout, driven the way `content-form` drives it: one `AutoForm`,
 * one provider, sections in place of a plugin's own layout component.
 */
const Harness = ({
  mode = "edit",
  onSubmit = vi.fn(),
  sections = SECTIONS,
}: {
  mode?: "create" | "edit";
  onSubmit?: () => void;
  sections?: ContentFormSectionSpec[];
}) => (
  <AutoForm
    fields={[
      {
        id: "title",
        component: props => <AutoFormInput label="Title" {...props} />,
      },
      {
        id: "content",
        component: props => <AutoFormInput label="Content" {...props} />,
      },
      {
        id: "category",
        component: props => <AutoFormInput label="Category" {...props} />,
      },
    ]}
    formSchema={schema}
    layout={fields => (
      <ContentFormProvider
        value={{
          fieldNames: ["title", "content", "category"],
          fields,
          localizedFieldNames: [],
          mode,
          publication: { enabled: false },
        }}
      >
        <ContentFormSections sections={sections} />
      </ContentFormProvider>
    )}
    onSubmit={onSubmit}
  />
);

/** The section card a field ended up in, by its heading. */
const sectionOf = (label: string): null | string => {
  const card = screen.getByLabelText(label).closest("section");

  return card?.querySelector("h2")?.textContent ?? null;
};

describe("generated form sections", () => {
  it("puts each field in the section that names it", () => {
    render(<Harness />);

    expect(sectionOf("Title")).toBe("General");
    expect(sectionOf("Content")).toBe("General");
    expect(sectionOf("Category")).toBe("Metadata");
  });

  it("renders the headings the spec carries, description included", () => {
    render(<Harness />);

    expect(screen.getByText("General")).toBeTruthy();
    expect(screen.getByText("Main content details")).toBeTruthy();
    // No `desc` on the second section, so nothing stands in for one.
    expect(screen.getByText("Metadata")).toBeTruthy();
  });

  it("keeps the sections in their declared order", () => {
    render(<Harness />);

    expect(
      [...document.querySelectorAll("section h2")].map(
        heading => heading.textContent,
      ),
    ).toEqual(["General", "Metadata"]);
  });

  it("submits every grouped field through the one form", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Hello world" },
    });

    const submit = screen.getByRole("button", { name: "edit.submit" });
    await waitFor(() => {
      expect(submit.getAttribute("disabled")).toBeNull();
    });
    fireEvent.click(submit);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        { category: "Reference", content: "Body", title: "Hello world" },
        expect.anything(),
        expect.anything(),
      );
    });
  });

  it("labels the submit for the mode it is in", () => {
    const { rerender } = render(<Harness mode="create" />);

    expect(screen.getByRole("button", { name: "create.submit" })).toBeTruthy();

    rerender(<Harness mode="edit" />);

    expect(screen.getByRole("button", { name: "edit.submit" })).toBeTruthy();
  });

  it("places a field no section names rather than dropping it", () => {
    // Define-time validation makes this unreachable through `admin.form`, and
    // the failure it guards against is silent: a field missing from the payload.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(
      <Harness
        sections={[{ fields: ["title"], name: "general", title: "General" }]}
      />,
    );

    expect(screen.getByLabelText("Content")).toBeTruthy();
    expect(screen.getByLabelText("Category")).toBeTruthy();
    // Placed, so the provider's development check has nothing to report.
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
