import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type FieldValues, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import type { ContentFormFieldSpec } from "@/content/admin/spec";

import { Form, FormField } from "@/components/ui/form";

import { ContentField } from "./field-component";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join(",")}` : key,
}));

/**
 * The three Stage 6 editors, driven through the real AutoForm seam.
 *
 * Every assertion is about what the *form value* becomes, because that value is
 * exactly what the API takes: a group controls a nested object, a to-many
 * relation controls a list of identifiers, and a repeatable controls a list of
 * rows where an existing child keeps its `id` and a new one has none. If the
 * shapes here are right, nothing has to be converted on submit.
 */

let latest: FieldValues = {};

const Harness = ({
  initial,
  loadOptions = async () => Promise.resolve([]),
  spec,
}: {
  initial?: unknown;
  loadOptions?: (args: {
    field: string;
    search: string;
  }) => Promise<{ label: string; value: string }[]>;
  spec: ContentFormFieldSpec;
}) => {
  const form = useForm({ defaultValues: { value: initial } as FieldValues });
  latest = form.watch();

  return (
    // The to-many picker wraps the async combobox, which fetches through
    // TanStack Query - so the harness has to provide a client the way the real
    // AdminCP layout does.
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <Form form={form} onSubmit={vi.fn()}>
        <FormField
          control={form.control}
          name="value"
          render={({ field }) => (
            <ContentField
              field={field}
              loadOptions={loadOptions}
              otherProps={{ isOptional: !spec.required }}
              spec={spec}
            />
          )}
        />
      </Form>
    </QueryClientProvider>
  );
};

const seoSpec: ContentFormFieldSpec = {
  fields: [
    {
      kind: "text",
      label: "SEO title",
      name: "title",
      nullable: true,
      required: false,
    },
    {
      kind: "textarea",
      label: "SEO description",
      name: "description",
      nullable: true,
      required: false,
    },
  ],
  kind: "group",
  label: "SEO",
  name: "seo",
  nullable: true,
  required: false,
};

const faqSpec: ContentFormFieldSpec = {
  fields: [
    {
      kind: "text",
      label: "Question",
      name: "question",
      nullable: false,
      required: true,
    },
    {
      kind: "textarea",
      label: "Answer",
      name: "answer",
      nullable: false,
      required: true,
    },
  ],
  kind: "repeatable",
  label: "FAQ",
  maxItems: 2,
  name: "faq",
  nullable: false,
  required: false,
};

const categoriesSpec: ContentFormFieldSpec = {
  kind: "relation",
  label: "Categories",
  multiple: true,
  name: "categories",
  nullable: false,
  required: false,
};

describe("group editor", () => {
  it("renders a labelled section with one input per leaf", () => {
    render(
      <Harness initial={{ description: null, title: null }} spec={seoSpec} />,
    );

    // A `fieldset`/`legend`, so a screen reader announces "SEO" with every leaf
    // - which is what tells `SEO / Title` from `Article / Title`.
    expect(screen.getByRole("group", { name: "SEO" })).toBeTruthy();
    expect(screen.getByText("SEO title")).toBeTruthy();
    expect(screen.getByText("SEO description")).toBeTruthy();
  });

  it("writes one leaf without disturbing the others", async () => {
    render(
      <Harness initial={{ description: "Kept", title: null }} spec={seoSpec} />,
    );

    fireEvent.change(screen.getByLabelText(/SEO title/), {
      target: { value: "New" },
    });

    await waitFor(() => {
      expect(latest.value).toStrictEqual({
        description: "Kept",
        title: "New",
      });
    });
  });

  it("turns a nullable group off as null, not as an empty object", async () => {
    render(
      <Harness initial={{ description: "A", title: "B" }} spec={seoSpec} />,
    );

    fireEvent.click(screen.getByRole("switch"));

    await waitFor(() => {
      // `null` is the group's absence, and it is a different stored state from
      // every leaf happening to be empty.
      expect(latest.value).toBeNull();
    });
  });

  it("shows no switch for a group that cannot be null", () => {
    render(
      <Harness
        initial={{ title: null }}
        spec={{ ...seoSpec, nullable: false }}
      />,
    );

    expect(screen.queryByRole("switch")).toBeNull();
  });
});

describe("repeatable editor", () => {
  it("says so when there is nothing yet", () => {
    render(<Harness initial={[]} spec={faqSpec} />);

    expect(screen.getByText("list.empty")).toBeTruthy();
  });

  it("adds a row with no id, which is what marks it new", async () => {
    render(<Harness initial={[]} spec={faqSpec} />);

    fireEvent.click(screen.getByRole("button", { name: /list\.add/ }));

    await waitFor(() => {
      expect(latest.value).toStrictEqual([{}]);
    });
  });

  it("stops at the declared maximum", () => {
    render(
      <Harness
        initial={[
          { answer: "A", id: 1, question: "One" },
          { answer: "B", id: 2, question: "Two" },
        ]}
        spec={faqSpec}
      />,
    );

    const add = screen.getByRole("button", { name: /list\.add/ });

    expect(add.hasAttribute("disabled")).toBe(true);
    fireEvent.click(add);

    expect((latest.value as unknown[]).length).toBe(2);
  });

  it("reorders with labelled buttons rather than only by dragging", async () => {
    render(
      <Harness
        initial={[
          { answer: "A", id: 1, question: "One" },
          { answer: "B", id: 2, question: "Two" },
        ]}
        spec={faqSpec}
      />,
    );

    // Every control is reachable and named, which drag-and-drop alone is not.
    fireEvent.click(screen.getByRole("button", { name: "list.move_down:1" }));

    await waitFor(() => {
      expect(
        (latest.value as { id: number }[]).map(row => row.id),
      ).toStrictEqual([2, 1]);
    });
  });

  it("disables the reorder button that would do nothing", () => {
    render(
      <Harness
        initial={[
          { answer: "A", id: 1, question: "One" },
          { answer: "B", id: 2, question: "Two" },
        ]}
        spec={faqSpec}
      />,
    );

    expect(
      screen
        .getByRole("button", { name: "list.move_up:1" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "list.move_down:2" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("removes a row and keeps every other identity", async () => {
    render(
      <Harness
        initial={[
          { answer: "A", id: 1, question: "One" },
          { answer: "B", id: 2, question: "Two" },
        ]}
        spec={faqSpec}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "list.remove:1" }));

    await waitFor(() => {
      expect(latest.value).toStrictEqual([
        { answer: "B", id: 2, question: "Two" },
      ]);
    });
  });

  it("keeps an existing child's id when its values are edited", async () => {
    render(
      <Harness
        initial={[{ answer: "A", id: 11, question: "One" }]}
        spec={faqSpec}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Question/), {
      target: { value: "One!" },
    });

    await waitFor(() => {
      // Identity survives the edit, so the service updates the child in place
      // rather than deleting it and creating a copy.
      expect(latest.value).toStrictEqual([
        { answer: "A", id: 11, question: "One!" },
      ]);
    });
  });
});

describe("to-many relation picker", () => {
  const loadOptions = async () =>
    Promise.resolve([
      { label: "News", value: "1" },
      { label: "Guides", value: "2" },
    ]);

  it("holds identifiers rather than combobox options", () => {
    render(
      <Harness
        initial={[1, 2]}
        loadOptions={loadOptions}
        spec={categoriesSpec}
      />,
    );

    // Exactly what the API takes - nothing to convert on submit, which is what
    // `contentFormValuesToPayload` skipping a `multiple` relation relies on.
    expect(latest.value).toStrictEqual([1, 2]);
    // Falls back to the identifier until the picker has resolved a name for it.
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("removes a target without touching the others", async () => {
    render(
      <Harness
        initial={[1, 2]}
        loadOptions={loadOptions}
        spec={categoriesSpec}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "list.remove:1" }));

    await waitFor(() => {
      expect(latest.value).toStrictEqual([2]);
    });
  });

  it("offers no reorder controls for an unordered relation", () => {
    render(
      <Harness
        initial={[1, 2]}
        loadOptions={loadOptions}
        spec={categoriesSpec}
      />,
    );

    // The engine stores an unordered set in ascending target-id order whatever
    // the editor does, so buttons here would visibly do nothing.
    expect(screen.queryByRole("button", { name: /list\.move_/ })).toBeNull();
  });

  it("offers them for an ordered one", async () => {
    render(
      <Harness
        initial={[1, 2]}
        loadOptions={loadOptions}
        spec={{ ...categoriesSpec, ordered: true }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "list.move_down:1" }));

    await waitFor(() => {
      expect(latest.value).toStrictEqual([2, 1]);
    });
  });
});
