import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type FieldValues, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { Form, FormField } from "@/components/ui/form";

import type { UserOption } from "./search-users.action.server";

import { AutoFormUser, type PartialUserOption } from "./input-users";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));
vi.mock("./search-users.action.server", () => ({ searchUsers: vi.fn() }));

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

const ADA: UserOption = {
  avatarColor: "aabbcc",
  id: 4,
  name: "Ada Lovelace",
  nameCode: "ada",
};
const GRACE: UserOption = {
  avatarColor: "ddeeff",
  id: 9,
  name: "Grace Hopper",
  nameCode: "grace",
};

const Harness = ({
  clearable = false,
  defaultValue,
  onValue,
  search = async () => Promise.resolve([ADA, GRACE]),
  selected,
}: {
  clearable?: boolean;
  defaultValue?: null | number;
  onValue?: (value: unknown) => void;
  search?: (value: string) => Promise<UserOption[]>;
  selected?: PartialUserOption;
}) => {
  const form = useForm({
    defaultValues: { authorId: defaultValue ?? null } as FieldValues,
  });
  onValue?.(form.watch("authorId"));

  return (
    <Form form={form} onSubmit={vi.fn()}>
      <FormField
        control={form.control}
        name="authorId"
        render={({ field }) => (
          <AutoFormUser
            clearable={clearable}
            field={field}
            label="Author"
            otherProps={{ isOptional: false }}
            placeholder="Pick an author"
            search={search}
            selected={selected}
          />
        )}
      />
    </Form>
  );
};

const openPicker = () => {
  fireEvent.click(screen.getByRole("button", { name: /pick an author/i }));
};

describe("AutoFormUser", () => {
  it("shows the placeholder until somebody is chosen", () => {
    render(<Harness />);

    expect(
      screen.getByRole("button", { name: /pick an author/i }),
    ).toBeDefined();
  });

  it("stores the user id, not the whole person", async () => {
    // What makes the field usable from a schema: `z.object({ authorId: z.number() })`.
    const values: unknown[] = [];
    render(
      <Harness
        onValue={value => {
          values.push(value);
        }}
      />,
    );

    openPicker();
    fireEvent.click(await screen.findByText("Ada Lovelace"));

    await waitFor(() => {
      expect(values.at(-1)).toBe(4);
    });
  });

  it("labels the id it holds with the name it just learned", async () => {
    render(<Harness />);

    openPicker();
    fireEvent.click(await screen.findByText("Grace Hopper"));

    // The trigger has to read as a person, not as `9` - and nothing re-fetches
    // between choosing and rendering.
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /grace hopper/i }),
      ).toBeDefined();
    });
  });

  it("opens on the person an edit form already knows about", () => {
    // Without `selected` the field holds an id it has never seen a name for, so
    // it would open on the placeholder as though nothing were chosen.
    render(<Harness defaultValue={4} selected={ADA} />);

    expect(screen.getByRole("button", { name: /ada lovelace/i })).toBeDefined();
  });

  describe("the avatar", () => {
    const avatars = () =>
      screen
        .getAllByRole("button", { name: /lovelace/i })[0]
        .querySelectorAll("img");

    it("is drawn from the colour when there is one", () => {
      render(<Harness defaultValue={4} selected={ADA} />);

      expect(avatars()).toHaveLength(1);
    });

    it("falls back to a placeholder when the caller knows only a name", () => {
      // The Content Engine case: a record resolves its author's *label* and
      // carries no colour, and a name sitting alone reads as a broken row.
      render(
        <Harness defaultValue={4} selected={{ id: 4, name: "Ada Lovelace" }} />,
      );

      const trigger = screen.getByRole("button", { name: /ada lovelace/i });
      // No generated avatar - inventing a colour would show a different person -
      // but the box is still there, so the name does not move when a search
      // fills the real one in.
      expect(trigger.querySelectorAll("img")).toHaveLength(0);
      expect(trigger.querySelector("svg.lucide-user")).not.toBeNull();
    });

    it("becomes the real one once a search has run", async () => {
      render(
        <Harness defaultValue={4} selected={{ id: 4, name: "Ada Lovelace" }} />,
      );

      // The trigger already reads as the person, so it is what opens the list.
      fireEvent.click(screen.getByRole("button", { name: /ada lovelace/i }));
      fireEvent.click(await screen.findByRole("option", { name: /lovelace/i }));

      await waitFor(() => {
        expect(avatars()).toHaveLength(1);
      });
    });
  });

  describe("the clear button", () => {
    const clear = () => screen.queryByRole("button", { name: "remove" });

    it("sits inside the control rather than beside it", () => {
      // It used to be a flex sibling of a `w-full` trigger, which pushed it out
      // of the card the field lives in.
      render(<Harness clearable defaultValue={4} selected={ADA} />);

      const trigger = screen.getByRole("button", { name: /ada lovelace/i });
      expect(clear()?.parentElement).toBe(trigger.parentElement);
      expect(clear()?.className).toContain("absolute");
    });

    it("is absent while there is nothing to clear", () => {
      render(<Harness clearable />);

      expect(clear()).toBeNull();
    });

    it("is absent on a field that does not allow one", () => {
      // A required author with a clear button is a button whose only outcome is
      // a validation error.
      render(<Harness defaultValue={4} selected={ADA} />);

      expect(clear()).toBeNull();
    });

    it("puts the field back to nobody", async () => {
      const values: unknown[] = [];
      render(
        <Harness
          clearable
          defaultValue={4}
          onValue={value => {
            values.push(value);
          }}
          selected={ADA}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "remove" }));

      await waitFor(() => {
        expect(values.at(-1)).toBeNull();
      });
      expect(
        screen.getByRole("button", { name: /pick an author/i }),
      ).toBeDefined();
    });
  });

  it("searches again on every open, with what was typed", async () => {
    const search = vi.fn(async () => Promise.resolve([ADA]));
    render(<Harness search={search} />);

    openPicker();

    // The empty search runs on open: the list is a live view of who exists, and
    // a cached one offers somebody who was deleted since.
    await waitFor(() => {
      expect(search).toHaveBeenCalledWith("");
    });
  });

  it("survives a search that throws", async () => {
    // A lookup that fails must not take down the form around it.
    const search = vi.fn(async () => Promise.reject(new Error("offline")));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<Harness search={search} />);

    openPicker();

    await waitFor(() => {
      expect(search).toHaveBeenCalled();
    });
    expect(
      screen.getByRole("button", { name: /pick an author/i }),
    ).toBeDefined();
  });
});
