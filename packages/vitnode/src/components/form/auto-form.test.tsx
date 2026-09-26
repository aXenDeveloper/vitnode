import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import z from "zod";

import type { ItemAutoFormComponentProps } from "./auto-form";

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
