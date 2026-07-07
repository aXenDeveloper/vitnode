import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type FieldValues, useForm } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Form, FormField } from "@/components/ui/form";

import { AutoFormSelect } from "./select";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

const ENUM = ["apple", "banana", "cherry"];

const Harness = ({
  onSubmit = vi.fn(),
  defaultValue,
  onReady,
}: {
  defaultValue?: string;
  onReady?: (reset: (value: string) => void) => void;
  onSubmit?: (values: FieldValues) => void;
}) => {
  const form = useForm({
    defaultValues: { fruit: defaultValue } as FieldValues,
  });

  onReady?.(value => form.reset({ fruit: value }));

  return (
    <Form form={form} onSubmit={onSubmit}>
      <FormField
        control={form.control}
        name="fruit"
        render={({ field }) => (
          <AutoFormSelect
            description="Pick one"
            field={field}
            label="Fruit"
            labels={[
              { value: "apple", label: "Apple" },
              { value: "banana", label: "Banana" },
              { value: "cherry", label: "Cherry" },
            ]}
            otherProps={{ enum: ENUM, isOptional: false }}
          />
        )}
      />
      <button type="submit">submit</button>
    </Form>
  );
};

describe("AutoFormSelect", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("renders label and description", () => {
    render(<Harness />);

    expect(screen.getByText("Fruit")).toBeDefined();
    expect(screen.getByText("Pick one")).toBeDefined();
  });

  it("reflects the initial form value on the trigger", () => {
    render(<Harness defaultValue="banana" />);

    expect(screen.getByRole("combobox").textContent).toContain("Banana");
  });

  it("submits the selected value", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("combobox"));
    const option = await screen.findByRole("option", { name: "Cherry" });
    fireEvent.pointerDown(option);
    fireEvent.click(option);
    fireEvent.click(screen.getByRole("button", { name: "submit" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        { fruit: "cherry" },
        expect.anything(),
      );
    });
  });

  it("stays controlled when the value arrives after mount without warning", async () => {
    let reset: ((value: string) => void) | undefined;
    render(<Harness onReady={fn => (reset = fn)} />);

    reset?.("cherry");

    await waitFor(() => {
      expect(screen.getByRole("combobox").textContent).toContain("Cherry");
    });

    const warned = errorSpy.mock.calls.some(call =>
      call.some(
        arg =>
          typeof arg === "string" &&
          arg.includes("changing the default value state"),
      ),
    );
    expect(warned).toBe(false);
  });
});
