import type { ContentFormLayoutProps } from "@vitnode/core/lib/plugin";

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
 * handed, by name, and must not know or care what a field actually is.
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
  surface = "shared",
}: {
  fieldNames: string[];
  surface?: ContentFormLayoutProps["surface"];
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
          mode: "edit",
          publication: { enabled: true, publishedAt: null, status: "draft" },
          surface,
        }}
      >
        <BlogArticleFormLayout
          contentTypeId="blog.post"
          itemId={7}
          mode="edit"
          pluginId="@vitnode/blog"
          publication
          singular="Article"
          surface={surface}
        />
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

  it("renders the publication state as a read-only line, with no publish control", () => {
    renderLayout({ fieldNames: ["title"] });

    expect(screen.getByText("draft")).toBeTruthy();
    // One button only: save. Publishing stays where the engine put it.
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("places the same names on a locale tab, ignoring the ones that are not there", () => {
    // A localized content type splits its fields in two. The shared surface has
    // no `title`, and the layout has to cope without knowing that.
    renderLayout({ fieldNames: ["categoryId", "authorId"] });

    expect(screen.getByText("field:categoryId", { exact: false })).toBeTruthy();
    expect(screen.queryByText("field:title", { exact: false })).toBeNull();
  });

  it("explains itself on a locale tab", () => {
    renderLayout({ fieldNames: ["title"], surface: "translation" });

    expect(screen.getByText("settings.locale_desc")).toBeTruthy();
  });
});
