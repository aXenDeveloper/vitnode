import { render, screen } from "@testing-library/react";
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
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  usePathname: () => "/admin/content/blog/post",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

/**
 * "We are inside a dialog", which is what `setIsDirty` means to every form in
 * the AdminCP - `useDialog` returns it only under a `Dialog` provider.
 *
 * Mocked rather than mounted because Base UI's dialog portals, and the question
 * here is not whether Base UI works: it is whether adding `admin.form.sections`
 * to a dialog-mode content type keeps the footer the ungrouped form has. It got
 * its own file because the mock has to replace the module for `AutoForm` too.
 */
vi.mock("@/components/ui/dialog", () => ({
  DialogClose: ({ render: element }: { render: React.ReactElement }) => element,
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
  useDialog: () => ({ open: true, setIsDirty: vi.fn() }),
}));

const SECTIONS: ContentFormSectionSpec[] = [
  { fields: ["title"], name: "general", title: "General" },
];

const Harness = () => (
  <AutoForm
    fields={[
      {
        id: "title",
        component: props => <AutoFormInput label="Title" {...props} />,
      },
    ]}
    formSchema={z.object({ title: z.string().min(1).default("Hello") })}
    layout={fields => (
      <ContentFormProvider
        value={{
          fieldNames: ["title"],
          fields,
          localizedFieldNames: [],
          mode: "create",
          publication: { enabled: false },
        }}
      >
        <ContentFormSections sections={SECTIONS} />
      </ContentFormProvider>
    )}
    onSubmit={vi.fn()}
  />
);

describe("generated form sections, in a dialog", () => {
  it("keeps the dialog footer, cancel included", () => {
    render(<Harness />);

    const footer = screen.getByTestId("dialog-footer");

    expect(
      footer.contains(screen.getByRole("button", { name: "cancel" })),
    ).toBe(true);
    expect(
      footer.contains(screen.getByRole("button", { name: "create.submit" })),
    ).toBe(true);
  });

  it("renders one submit, not two", () => {
    render(<Harness />);

    // `AutoForm` renders none of its own once a layout is in play. A second one
    // here would be a second way to write the same record.
    expect(
      screen.getAllByRole("button", { name: "create.submit" }),
    ).toHaveLength(1);
  });
});
