import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import z from "zod";

import type { ItemAutoFormComponentProps } from "./auto-form";

import { FormMessage } from "../ui/form";
import { AutoForm } from "./auto-form";

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
      onChange={field.onChange}
      value={String(field.value ?? "")}
    />
    <FormMessage />
  </>
);

describe("a form that can be submitted while invalid", () => {
  it("keeps the submit button disabled by default", () => {
    render(
      <AutoForm
        fields={[{ id: "title", component: RequiredTitleField }]}
        formSchema={requiredSchema}
      />,
    );

    expect(
      screen.getByRole("button", { name: "core.global.submit" }),
    ).toHaveProperty("disabled", true);
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
