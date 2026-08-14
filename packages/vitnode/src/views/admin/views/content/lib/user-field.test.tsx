import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type FieldValues, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import type { ContentFormFieldSpec } from "@/content/admin/spec";

import { Form, FormField } from "@/components/ui/form";

import type { ContentOption } from "./field-component";

import { ContentUserField } from "./user-field";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/components/form/fields/search-users.action.server", () => ({
  searchUsers: vi.fn(),
}));

/** `cmdk` measures its list and scrolls the active row into view. */
vi.stubGlobal(
  "ResizeObserver",
  class {
    disconnect() {}
    observe() {}
    unobserve() {}
  },
);
Element.prototype.scrollIntoView = vi.fn();

const spec = {
  kind: "user",
  label: "Author",
  name: "authorId",
  nullable: false,
  required: true,
} as unknown as ContentFormFieldSpec;

/** What the picker route answers for a `user` field. */
const OPTIONS: ContentOption[] = [
  { avatarColor: "928d17", label: "aXen", nameCode: "axen", value: "2" },
  { avatarColor: "b89e28", label: "test3", nameCode: "test3", value: "3" },
];

const Harness = ({
  loadOptions = async () => Promise.resolve(OPTIONS),
  onValue,
  value,
}: {
  loadOptions?: (args: {
    field: string;
    search: string;
  }) => Promise<ContentOption[]>;
  onValue?: (value: unknown) => void;
  /** What an edit form arrives with: an id and a resolved label, no colour. */
  value?: null | { label: string; value: string };
}) => {
  const form = useForm({
    defaultValues: { authorId: value ?? null } as FieldValues,
  });
  onValue?.(form.watch("authorId"));

  return (
    <Form form={form} onSubmit={vi.fn()}>
      <FormField
        control={form.control}
        name="authorId"
        render={({ field }) => (
          <ContentUserField
            field={field}
            loadOptions={loadOptions}
            otherProps={{ isOptional: false }}
            spec={spec}
          />
        )}
      />
    </Form>
  );
};

const trigger = () => screen.getByRole("button", { name: /axen/i });

describe("the Content Engine user field", () => {
  it("shows the author's avatar without anybody opening the picker", async () => {
    // The reported bug: an article's author rendered as a name beside a generic
    // icon, because the record carries a label and no colour.
    render(<Harness value={{ label: "aXen", value: "2" }} />);

    expect(trigger().querySelector("svg.lucide-user")).not.toBeNull();

    await waitFor(() => {
      expect(trigger().querySelectorAll("img")).toHaveLength(1);
    });
  });

  it("looks the author up by the label the record arrived with", async () => {
    const loadOptions = vi.fn(async () => Promise.resolve(OPTIONS));
    render(
      <Harness
        loadOptions={loadOptions}
        value={{ label: "aXen", value: "2" }}
      />,
    );

    await waitFor(() => {
      expect(loadOptions).toHaveBeenCalledWith({
        field: "authorId",
        search: "aXen",
      });
    });
  });

  it("matches by id, so a similar name cannot supply the wrong face", async () => {
    // The search is by label and the label is not unique. Only the id decides.
    const loadOptions = vi.fn(async () =>
      Promise.resolve([
        {
          avatarColor: "ffffff",
          label: "aXen",
          nameCode: "other",
          value: "99",
        },
      ]),
    );
    render(
      <Harness
        loadOptions={loadOptions}
        value={{ label: "aXen", value: "2" }}
      />,
    );

    await waitFor(() => {
      expect(loadOptions).toHaveBeenCalled();
    });
    expect(trigger().querySelectorAll("img")).toHaveLength(0);
  });

  it("looks nothing up when the record has no author", () => {
    const loadOptions = vi.fn(async () => Promise.resolve(OPTIONS));
    render(<Harness loadOptions={loadOptions} />);

    expect(loadOptions).not.toHaveBeenCalled();
  });

  it("keeps holding the label and value pair the API expects", async () => {
    // The form value shape is the Content Engine's, not the picker's.
    const values: unknown[] = [];
    render(
      <Harness
        onValue={value => {
          values.push(value);
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /relation/i }));
    fireEvent.click(await screen.findByRole("option", { name: /test3/i }));

    await waitFor(() => {
      expect(values.at(-1)).toEqual({ label: "test3", value: "3" });
    });
  });
});
