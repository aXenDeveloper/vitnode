import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type FieldValues, useForm, useWatch } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { Form, FormField } from "@/components/ui/form";

import type { RoleOption } from "./search-roles.action.server";

import { AutoFormRoles, roleOptionName } from "./input-roles";

vi.mock("next-intl", () => ({
  useLocale: () => "pl",
  useTranslations: () => (key: string) => key,
}));
vi.mock("./search-roles.action.server", () => ({ searchRoles: vi.fn() }));

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

const ADMIN: RoleOption = {
  color: "#ff0000",
  id: 1,
  name: [
    { languageCode: "en", name: "Administrator" },
    { languageCode: "pl", name: "Administrator PL" },
  ],
};
const EDITOR: RoleOption = {
  color: null,
  id: 2,
  name: [{ languageCode: "en", name: "Editor" }],
};

const Harness = ({
  defaultValue,
  excludeIds,
  multiple = false,
  onValue,
  search = async () => Promise.resolve([ADMIN, EDITOR]),
  selected = [],
}: {
  defaultValue?: unknown;
  excludeIds?: number[];
  multiple?: boolean;
  onValue?: (value: unknown) => void;
  search?: (value: string) => Promise<RoleOption[]>;
  selected?: RoleOption[];
}) => {
  const form = useForm({
    defaultValues: {
      roles: defaultValue ?? (multiple ? [] : null),
    } as FieldValues,
  });
  const roles = useWatch({ control: form.control, name: "roles" });

  onValue?.(roles);

  return (
    <Form form={form} onSubmit={vi.fn()}>
      <FormField
        control={form.control}
        name="roles"
        render={({ field }) => (
          <AutoFormRoles
            excludeIds={excludeIds}
            field={field}
            label="Roles"
            multiple={multiple}
            otherProps={{ isOptional: false }}
            placeholder="Pick a role"
            search={search}
            selected={selected}
          />
        )}
      />
    </Form>
  );
};

const openPicker = () => {
  fireEvent.click(screen.getByRole("button", { name: /pick a role/i }));
};

describe("roleOptionName", () => {
  it("prefers the reader's language", () => {
    expect(roleOptionName(ADMIN, "pl")).toBe("Administrator PL");
  });

  it("falls back to the first translation, never to the id", () => {
    // A role with no Polish name is still a role somebody named.
    expect(roleOptionName(EDITOR, "pl")).toBe("Editor");
  });

  it("falls back to the id only when there is no name at all", () => {
    expect(roleOptionName({ color: null, id: 7, name: [] }, "pl")).toBe("7");
  });
});

describe("AutoFormRoles, single", () => {
  it("stores one id", async () => {
    const values: unknown[] = [];
    render(
      <Harness
        onValue={value => {
          values.push(value);
        }}
      />,
    );

    openPicker();
    fireEvent.click(await screen.findByText("Editor"));

    await waitFor(() => {
      expect(values.at(-1)).toBe(2);
    });
  });

  it("replaces rather than appends", async () => {
    const values: unknown[] = [];
    render(
      <Harness
        onValue={value => {
          values.push(value);
        }}
      />,
    );

    openPicker();
    fireEvent.click(await screen.findByText("Editor"));
    await waitFor(() => {
      expect(values.at(-1)).toBe(2);
    });

    fireEvent.click(screen.getByRole("button", { name: /editor/i }));
    fireEvent.click(await screen.findByText("Administrator PL"));

    await waitFor(() => {
      expect(values.at(-1)).toBe(1);
    });
  });

  it("names the role it opens on in the reader's language", () => {
    render(<Harness defaultValue={1} selected={[ADMIN]} />);

    expect(
      screen.getByRole("button", { name: /administrator pl/i }),
    ).toBeDefined();
  });
});

describe("AutoFormRoles, multiple", () => {
  it("collects ids into an array", async () => {
    const values: unknown[] = [];
    render(
      <Harness
        multiple
        onValue={value => {
          values.push(value);
        }}
      />,
    );

    openPicker();
    fireEvent.click(await screen.findByText("Administrator PL"));
    await waitFor(() => {
      expect(values.at(-1)).toEqual([1]);
    });

    openPicker();
    fireEvent.click(await screen.findByText("Editor"));

    await waitFor(() => {
      expect(values.at(-1)).toEqual([1, 2]);
    });
  });

  it("toggles a role that is already chosen back off", async () => {
    // What the tick beside an option in the list is promising.
    const values: unknown[] = [];
    render(
      <Harness
        defaultValue={[1]}
        multiple
        onValue={value => {
          values.push(value);
        }}
        selected={[ADMIN]}
      />,
    );

    openPicker();
    // By role, not by text: the chip above the picker carries the same name, and
    // clicking that would prove nothing about the list.
    fireEvent.click(
      await screen.findByRole("option", { name: /administrator pl/i }),
    );

    await waitFor(() => {
      expect(values.at(-1)).toEqual([]);
    });
  });

  it("lists what is chosen as removable chips", async () => {
    const values: unknown[] = [];
    render(
      <Harness
        defaultValue={[1, 2]}
        multiple
        onValue={value => {
          values.push(value);
        }}
        selected={[ADMIN, EDITOR]}
      />,
    );

    expect(screen.getByText("Administrator PL")).toBeDefined();
    expect(screen.getByText("Editor")).toBeDefined();

    fireEvent.click(screen.getAllByRole("button", { name: "remove" })[0]);

    await waitFor(() => {
      expect(values.at(-1)).toEqual([2]);
    });
  });

  it("never offers an excluded role", async () => {
    const search = vi.fn(async () => Promise.resolve([ADMIN, EDITOR]));
    render(<Harness excludeIds={[1]} multiple search={search} />);

    openPicker();

    expect(await screen.findByText("Editor")).toBeDefined();
    expect(screen.queryByText("Administrator PL")).toBeNull();
  });
});
