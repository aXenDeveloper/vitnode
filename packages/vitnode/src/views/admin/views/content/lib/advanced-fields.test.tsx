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
// The people picker ships a default lookup that reaches the server. Nothing here
// uses it - every field is handed a `loadOptions` - but the import is real, and
// `@/lib/fetcher` is `server-only`.
vi.mock("@/components/form/fields/search-users.action.server", () => ({
  searchUsers: vi.fn(),
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
      { color: "#3260c0", label: "News", value: "1" },
      { label: "Guides", value: "2" },
    ]);

  it("holds identifiers rather than combobox options", async () => {
    const { container } = render(
      <Harness
        initial={[1, 2]}
        loadOptions={loadOptions}
        spec={categoriesSpec}
      />,
    );

    // Exactly what the API takes - nothing to convert on submit, which is what
    // `contentFormValuesToPayload` skipping a `multiple` relation relies on.
    expect(latest.value).toStrictEqual([1, 2]);
    // A chip whose label has not arrived is a skeleton rather than its
    // identifier: `1` reads as data, and the field would look wrong rather than
    // busy for as long as the lookup takes.
    expect(container.querySelectorAll("[data-slot='skeleton']").length).toBe(2);
    expect(screen.queryByText("1")).toBeNull();

    await waitFor(() => {
      expect(screen.getByText("News")).toBeTruthy();
    });
    expect(container.querySelector("[data-slot='skeleton']")).toBeNull();
  });

  it("removes a target without touching the others", async () => {
    render(
      <Harness
        initial={[1, 2]}
        loadOptions={loadOptions}
        spec={categoriesSpec}
      />,
    );

    // Each chip carries its own remove control - the multi-select combobox's
    // own affordance, rather than a list of rows beside it.
    const [first] = screen.getAllByRole("button", { name: "remove" });
    fireEvent.click(first);

    await waitFor(() => {
      expect(latest.value).toStrictEqual([2]);
    });
  });

  it("keeps what is chosen as chips inside the control", () => {
    const { container } = render(
      <Harness
        initial={[1, 2]}
        loadOptions={loadOptions}
        spec={categoriesSpec}
      />,
    );

    expect(
      container.querySelector("[data-slot='combobox-chips']"),
    ).toBeTruthy();
    expect(
      container.querySelectorAll("[data-slot='combobox-chip']"),
    ).toHaveLength(2);
  });

  it("draws the colour a target declares, and nothing when it has none", async () => {
    const { container } = render(
      <Harness
        initial={[1, 2]}
        loadOptions={loadOptions}
        spec={categoriesSpec}
      />,
    );

    // A category is its colour as much as its word, so the chip carries the
    // swatch the options route sent.
    await waitFor(() => {
      expect(screen.getByText("News")).toBeTruthy();
    });

    const swatches = container.querySelectorAll(
      "[data-slot='combobox-chip'] span[style]",
    );

    expect(swatches).toHaveLength(1);
    expect(swatches[0].getAttribute("style")).toContain("rgb(50, 96, 192)");
  });

  it("draws a single chip's colour, whatever CSS colour the target stores", async () => {
    // The blog's own shape: one category, an `hsl()` colour rather than a hex
    // one - the colour is written by a colour picker and stored verbatim, so
    // the swatch has to take the string as it comes rather than parse it.
    const { container } = render(
      <Harness
        initial={[1]}
        loadOptions={async () =>
          Promise.resolve([
            { color: "hsl(200, 60%, 50%)", label: "ttt", value: "1" },
          ])
        }
        spec={categoriesSpec}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("ttt")).toBeTruthy();
    });

    const swatch = container.querySelector(
      "[data-slot='combobox-chip'] span[style]",
    );

    // jsdom normalises `hsl()` to `rgb()`, which is the browser's own
    // behaviour - what matters is that the string reached the swatch unparsed.
    expect(swatch?.getAttribute("style")).toContain("rgb(51, 153, 204)");
  });

  it("keeps an ordered relation in the order it holds", async () => {
    const { container } = render(
      <Harness
        initial={[2, 1]}
        loadOptions={loadOptions}
        spec={{ ...categoriesSpec, ordered: true }}
      />,
    );

    // The chip order *is* the stored order - there are no move buttons, and
    // there is nothing for them to do that reordering the value does not.
    // Asserted on the resolved names rather than the identifiers, because until
    // the lookup lands every chip is a skeleton with nothing to compare.
    await waitFor(() => {
      const chips = [
        ...container.querySelectorAll("[data-slot='combobox-chip']"),
      ].map(chip => chip.textContent);

      expect(chips).toStrictEqual(["Guides", "News"]);
    });
    expect(latest.value).toStrictEqual([2, 1]);
  });
});

describe("to-many people picker", () => {
  const authorsSpec: ContentFormFieldSpec = {
    kind: "user",
    label: "Authors",
    multiple: true,
    name: "authors",
    nullable: false,
    ordered: true,
    required: false,
  };

  const loadPeople = async ({ ids }: { ids?: number[]; search: string }) =>
    Promise.resolve(
      [
        { avatarColor: "3b82f6", label: "Ada", nameCode: "ada", value: "1" },
        {
          avatarColor: "ef4444",
          label: "Grace",
          nameCode: "grace",
          value: "2",
        },
      ].filter(person => !ids || ids.includes(Number(person.value))),
    );

  it("labels the ids it opened with, rather than showing numbers", async () => {
    render(
      <Harness initial={[1, 2]} loadOptions={loadPeople} spec={authorsSpec} />,
    );

    // The whole reason the options route takes `ids`: a set has no label on the
    // row it belongs to, so the names have to be asked for.
    await waitFor(() => {
      expect(screen.getByText("Ada")).toBeTruthy();
    });
    expect(screen.getByText("Grace")).toBeTruthy();
  });

  it("removes one person and keeps the rest, as identifiers", async () => {
    render(
      <Harness initial={[1, 2]} loadOptions={loadPeople} spec={authorsSpec} />,
    );

    const [first] = screen.getAllByRole("button", { name: "remove" });
    fireEvent.click(first);

    await waitFor(() => {
      expect(latest.value).toStrictEqual([2]);
    });
  });
});
