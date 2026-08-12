import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { ContentFormLayoutProps } from "@/lib/plugin";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormInput } from "@/components/form/fields/input";

import { ContentFormProvider } from "./context";
import {
  ContentFormActions,
  ContentFormField,
  ContentFormMain,
  ContentFormRemainingFields,
  ContentFormSidebar,
  ContentFormStatus,
} from "./primitives";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/navigation", () => ({
  // Spreads everything, like the real `Link` - a mock that swallowed the props
  // Base UI merges in would hide an accessibility warning rather than surface it.
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

/**
 * The whole point of the layout API, exercised end to end: two named fields in
 * two different places, one form, one submit.
 */
const Harness = ({
  fieldNames = ["title", "content", "category"],
  layout,
  mode = "edit",
  onSubmit = vi.fn(),
  publication = { enabled: false },
}: {
  fieldNames?: string[];
  layout: (props: ContentFormLayoutProps) => React.ReactNode;
  mode?: "create" | "edit";
  onSubmit?: () => void;
  publication?: { enabled: boolean; publishedAt?: unknown; status?: unknown };
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
          fieldNames,
          fields,
          localizedFieldNames: [],
          mode,
          publication,
        }}
      >
        {layout({
          contentTypeId: "blog.post",
          mode,
          pluginId: "@vitnode/blog",
          publication: publication.enabled,
          singular: "Article",
        })}
      </ContentFormProvider>
    )}
    onSubmit={onSubmit}
  />
);

describe("content form layouts", () => {
  it("places named fields wherever the layout puts them", () => {
    render(
      <Harness
        layout={() => (
          <>
            <ContentFormMain>
              <div data-testid="main">
                <ContentFormField name="title" />
                <ContentFormField name="content" />
              </div>
            </ContentFormMain>
            <ContentFormSidebar>
              <div data-testid="sidebar">
                <ContentFormField name="category" />
              </div>
            </ContentFormSidebar>
          </>
        )}
      />,
    );

    expect(screen.getByTestId("main").contains(screen.getByLabelText("Title")));
    expect(
      screen.getByTestId("main").contains(screen.getByLabelText("Content")),
    ).toBe(true);
    expect(
      screen.getByTestId("sidebar").contains(screen.getByLabelText("Category")),
    ).toBe(true);
    expect(
      screen.getByTestId("main").contains(screen.getByLabelText("Category")),
    ).toBe(false);
  });

  it("renders nothing for a field this surface does not have", () => {
    render(
      <Harness
        layout={() => (
          <>
            <ContentFormField name="title" />
            <ContentFormField name="does-not-exist" />
          </>
        )}
      />,
    );

    expect(screen.getByLabelText("Title")).toBeTruthy();
    expect(screen.queryByLabelText("Content")).toBeNull();
  });

  it("submits every placed field through one form", async () => {
    const onSubmit = vi.fn();
    render(
      <Harness
        layout={() => (
          <>
            <ContentFormField name="title" />
            <ContentFormField name="content" />
            <ContentFormField name="category" />
            <ContentFormActions submitLabel="Save" />
          </>
        )}
        onSubmit={onSubmit}
      />,
    );

    // The submit button stays disabled until react-hook-form has validated
    // once, which is what typing does - same as the generated form.
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Hello world" },
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Save" }).getAttribute("disabled"),
      ).toBeNull();
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        { category: "Reference", content: "Body", title: "Hello world" },
        expect.anything(),
        expect.anything(),
      );
    });
  });

  it("keeps a validation error attached to its own field", async () => {
    const onSubmit = vi.fn();
    render(
      <Harness
        layout={() => (
          <>
            <ContentFormField name="title" />
            <ContentFormField name="content" />
            <ContentFormField name="category" />
            <ContentFormActions submitLabel="Save" />
          </>
        )}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "" },
    });
    fireEvent.submit(screen.getByLabelText("Title").closest("form") as Element);

    await waitFor(() => {
      expect(screen.getByLabelText("Title").getAttribute("aria-invalid")).toBe(
        "true",
      );
    });
    expect(
      screen.getByLabelText("Content").getAttribute("aria-invalid"),
    ).not.toBe("true");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("fills in the fields a layout did not name", () => {
    render(
      <Harness
        layout={() => (
          <>
            <ContentFormField name="title" />
            <div data-testid="rest">
              <ContentFormRemainingFields exclude={["title"]} />
            </div>
          </>
        )}
      />,
    );

    expect(
      screen.getByTestId("rest").contains(screen.getByLabelText("Content")),
    ).toBe(true);
    expect(
      screen.getByTestId("rest").contains(screen.getByLabelText("Category")),
    ).toBe(true);
    expect(
      screen.getByTestId("rest").contains(screen.getByLabelText("Title")),
    ).toBe(false);
  });

  it("shows the publication line only when there is one to show", () => {
    const { rerender } = render(
      <Harness layout={() => <ContentFormStatus />} mode="create" />,
    );

    expect(screen.queryByText("draft")).toBeNull();

    rerender(
      <Harness
        layout={() => <ContentFormStatus />}
        mode="edit"
        publication={{ enabled: true, publishedAt: null, status: "draft" }}
      />,
    );

    expect(screen.getByText("draft")).toBeTruthy();
  });

  it("offers a way out that is a real link, and says so accessibly", () => {
    const errors: unknown[][] = [];
    const spy = vi
      .spyOn(console, "error")
      .mockImplementation((...args: unknown[]) => {
        errors.push(args);
      });

    render(
      <Harness
        fieldNames={[]}
        layout={() => (
          <ContentFormActions
            cancelHref="/admin/content/blog/post"
            submitLabel="Save"
          />
        )}
      />,
    );

    // `role="button"` on an anchor is Base UI's own answer for a non-native
    // button, and the same one every other link-button in the AdminCP gives.
    const cancel = screen.getByRole("button", { name: "cancel" });

    expect(cancel.tagName).toBe("A");
    expect(cancel.getAttribute("href")).toBe("/admin/content/blog/post");
    // Base UI only warns - a link-rendered button that kept `nativeButton` would
    // still look right and would have lost its button semantics.
    expect(errors).toEqual([]);
    spy.mockRestore();
  });

  it("warns in development about a field the layout forgot", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(<Harness layout={() => <ContentFormField name="title" />} />);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("content, category"),
    );
    warn.mockRestore();
  });
});
