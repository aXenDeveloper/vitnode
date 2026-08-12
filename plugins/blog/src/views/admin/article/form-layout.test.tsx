import { render, screen } from "@testing-library/react";
import { ContentFormProvider } from "@vitnode/core/views/admin/views/content/form/context";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { BlogArticleFormLayout } from "./form-layout";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@vitnode/core/lib/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

/**
 * The layout is rendered on its own, with stand-in elements where the Content
 * Engine would have put real fields.
 *
 * That is exactly the contract under test: the layout must place whatever it is
 * handed, by name, and must not know or care what a field actually is - or which
 * table its value ends up on.
 */
/** The submit button reads the surrounding form, exactly as it does for real. */
const Harness = ({ children }: { children: React.ReactNode }) => {
  const form = useForm();

  return (
    <FormProvider {...form}>
      <form>{children}</form>
    </FormProvider>
  );
};

const renderLayout = ({
  fieldNames,
  localizedFieldNames = ["title", "content", "friendlyUrl"],
}: {
  fieldNames: string[];
  localizedFieldNames?: string[];
}) =>
  render(
    <Harness>
      <ContentFormProvider
        value={{
          fieldNames,
          fields: Object.fromEntries(
            fieldNames.map(name => [
              name,
              <span key={name}>field:{name}</span>,
            ]),
          ),
          localizedFieldNames,
          mode: "edit",
          publication: { enabled: true, publishedAt: null, status: "draft" },
        }}
      >
        <BlogArticleFormLayout />
      </ContentFormProvider>
    </Harness>,
  );

describe("BlogArticleFormLayout", () => {
  it("puts the writing fields in the main column and the metadata beside them", () => {
    const { container } = renderLayout({
      fieldNames: ["title", "content", "friendlyUrl", "categoryId", "authorId"],
    });

    for (const name of [
      "title",
      "content",
      "friendlyUrl",
      "categoryId",
      "authorId",
    ]) {
      expect(screen.getByText(`field:${name}`, { exact: false })).toBeTruthy();
    }

    const sections = container.querySelectorAll("section");
    // Body, publish, article settings.
    expect(sections).toHaveLength(3);
    expect(sections[0].textContent).toContain("title");
    expect(sections[0].textContent).toContain("content");
    expect(sections[2].textContent).toContain("categoryId");
  });

  it("renders localized and shared fields in the same layout", () => {
    // The whole point of the new localization UX: `title` is on the translation
    // table and `categoryId` is on the base row, and this layout - the screen a
    // person actually looks at - cannot tell them apart.
    renderLayout({
      fieldNames: ["title", "content", "friendlyUrl", "categoryId", "authorId"],
    });

    expect(screen.getByText("field:title", { exact: false })).toBeTruthy();
    expect(screen.getByText("field:categoryId", { exact: false })).toBeTruthy();
  });

  it("renders no locale tab strip of any kind", () => {
    renderLayout({
      fieldNames: ["title", "content", "friendlyUrl", "categoryId", "authorId"],
    });

    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("renders the publication state as a read-only line, with no publish control", () => {
    renderLayout({ fieldNames: ["title"] });

    expect(screen.getByText("draft")).toBeTruthy();
    // One button only: save. Publishing stays where the engine put it.
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("ignores a name the form does not have", () => {
    renderLayout({ fieldNames: ["categoryId", "authorId"] });

    expect(screen.getByText("field:categoryId", { exact: false })).toBeTruthy();
    expect(screen.queryByText("field:title", { exact: false })).toBeNull();
  });
});
