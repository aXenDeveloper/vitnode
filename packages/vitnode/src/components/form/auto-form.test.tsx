import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import z from "zod";

import type { ItemAutoFormComponentProps } from "./auto-form";

import { FormControl, FormMessage } from "../ui/form";
import { AutoForm } from "./auto-form";
import { AutoFormDesc } from "./common/desc";

afterEach(() => {
  vi.unstubAllGlobals();
});

const LabelContext = React.createContext("first label");

const formSchema = z.object({ title: z.string() });

let mountCount = 0;

const TitleField = ({ field }: ItemAutoFormComponentProps) => {
  const [id] = React.useState(() => `title-control-${(mountCount += 1)}`);
  const label = React.use(LabelContext);

  return (
    <input
      aria-label={label}
      id={id}
      name={field.name}
      onChange={field.onChange}
      value={String(field.value ?? "")}
    />
  );
};

const Fields = React.memo(() => (
  <AutoForm
    fields={[{ id: "title", component: TitleField }]}
    formSchema={formSchema}
  />
));
Fields.displayName = "Fields";

const Harness = () => {
  const [label, setLabel] = React.useState("first label");

  return (
    <LabelContext value={label}>
      <button onClick={() => setLabel("second label")} type="button">
        rename
      </button>
      <Fields />
    </LabelContext>
  );
};

describe("a field component that reads context and keeps its own state", () => {
  it("survives a context change that re-renders it alone", () => {
    render(<Harness />);
    const input = screen.getByLabelText("first label");
    fireEvent.change(input, { target: { value: "Hello" } });

    fireEvent.click(screen.getByRole("button", { name: "rename" }));

    const renamed = screen.getByLabelText<HTMLInputElement>("second label");
    expect(renamed.value).toBe("Hello");
    expect(renamed.id).toBe(input.id);
  });
});

const requiredSchema = z.object({
  title: z.string().min(1, { message: "title is required" }).default(""),
});

const RequiredTitleField = ({ field }: ItemAutoFormComponentProps) => (
  <>
    <input
      aria-label="title"
      name={field.name}
      onBlur={field.onBlur}
      onChange={field.onChange}
      value={String(field.value ?? "")}
    />
    <FormMessage />
  </>
);

describe("a form that can be submitted while invalid", () => {
  it("keeps the submit button enabled, reveals the errors and focuses the first invalid field", async () => {
    const onSubmit = vi.fn();
    render(
      <AutoForm
        fields={[{ id: "title", component: RequiredTitleField }]}
        formSchema={requiredSchema}
        onSubmit={onSubmit}
      />,
    );
    const submit = screen.getByRole("button", { name: "core.global.submit" });

    expect(submit).toHaveProperty("disabled", false);
    expect(screen.queryByText("title is required")).toBeNull();

    fireEvent.click(submit);

    expect(await screen.findByText("title is required")).toBeDefined();
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText("title"));
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows a field's error once it has been left, then keeps it live", async () => {
    render(
      <AutoForm
        fields={[{ id: "title", component: RequiredTitleField }]}
        formSchema={requiredSchema}
      />,
    );
    const input = screen.getByLabelText("title");

    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.change(input, { target: { value: "" } });
    expect(screen.queryByText("title is required")).toBeNull();

    fireEvent.blur(input);
    expect(await screen.findByText("title is required")).toBeDefined();

    fireEvent.change(input, { target: { value: "Hello again" } });
    await waitFor(() => {
      expect(screen.queryByText("title is required")).toBeNull();
    });
  });

  it("reveals the errors on click without calling onSubmit", async () => {
    const onSubmit = vi.fn();
    render(
      <AutoForm
        canSubmitWhenInvalid
        fields={[{ id: "title", component: RequiredTitleField }]}
        formSchema={requiredSchema}
        onSubmit={onSubmit}
      />,
    );
    const submit = screen.getByRole("button", { name: "core.global.submit" });
    expect(screen.queryByText("title is required")).toBeNull();

    expect(submit).toHaveProperty("disabled", false);
    fireEvent.click(submit);

    expect(await screen.findByText("title is required")).toBeDefined();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits once the values are valid", async () => {
    const onSubmit = vi.fn();
    render(
      <AutoForm
        canSubmitWhenInvalid
        fields={[{ id: "title", component: RequiredTitleField }]}
        formSchema={requiredSchema}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText("title"), {
      target: { value: "Hello" },
    });
    fireEvent.click(screen.getByRole("button", { name: "core.global.submit" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        { title: "Hello" },
        expect.anything(),
        expect.anything(),
      );
    });
  });
});

const DescribedTitleField = ({ field }: ItemAutoFormComponentProps) => (
  <>
    <label htmlFor="title-form-item">title</label>
    <FormControl>
      <input
        name={field.name}
        onBlur={field.onBlur}
        onChange={field.onChange}
        value={String(field.value ?? "")}
      />
    </FormControl>
    <AutoFormDesc>Shown on the card</AutoFormDesc>
    <FormMessage />
  </>
);

const describedTextOf = (element: HTMLElement) =>
  (element.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .map(id => document.getElementById(id)?.textContent)
    .filter(Boolean);

describe("a field control described by its description and message", () => {
  it("points aria-describedby at the description, then the error too", async () => {
    render(
      <AutoForm
        fields={[{ id: "title", component: DescribedTitleField }]}
        formSchema={requiredSchema}
      />,
    );
    const input = screen.getByLabelText("title");

    expect(describedTextOf(input)).toEqual(["Shown on the card"]);

    fireEvent.click(screen.getByRole("button", { name: "core.global.submit" }));

    await waitFor(() => {
      expect(describedTextOf(input)).toEqual([
        "Shown on the card",
        "title is required",
      ]);
    });
  });
});

const tabbedSchema = z.object({
  title: z.string().default("Hello"),
  slug: z.string().min(1, { message: "slug is required" }).default(""),
});

const SlugField = ({ field }: ItemAutoFormComponentProps) => (
  <>
    <input
      aria-label="slug"
      name={field.name}
      onChange={field.onChange}
      value={String(field.value ?? "")}
    />
    <FormMessage />
  </>
);

describe("a tabbed form with an invalid field on another tab", () => {
  it("marks the tab, switches to it and focuses the field", async () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        disconnect() {}
        observe() {}
        unobserve() {}
      },
    );
    render(
      <AutoForm
        fields={[
          { id: "title", component: RequiredTitleField, tab: "general" },
          { id: "slug", component: SlugField, tab: "advanced" },
        ]}
        formSchema={tabbedSchema}
        tabs={[
          { label: "General", value: "general" },
          { label: "Advanced", value: "advanced" },
        ]}
      />,
    );

    expect(screen.queryByText("core.global.tab_has_errors")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "core.global.submit" }));

    expect(await screen.findByText("core.global.tab_has_errors")).toBeDefined();
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByLabelText("slug"));
    });
    expect(
      screen
        .getByRole("tab", { name: /Advanced/ })
        .getAttribute("aria-selected"),
    ).toBe("true");
  });
});

describe("the submit button's accessible name", () => {
  it("matches its visible label", () => {
    render(
      <AutoForm
        fields={[{ id: "title", component: TitleField }]}
        formSchema={formSchema}
        submitButtonProps={{ children: "Save category" }}
      />,
    );

    expect(screen.getByRole("button", { name: "Save category" })).toBeDefined();
  });
});
