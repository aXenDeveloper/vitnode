import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type FieldValues, useForm } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Form, FormField } from "@/components/ui/form";

import { AutoFormRadioGroup } from "./radio-group";

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
          <AutoFormRadioGroup
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

describe("AutoFormRadioGroup", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("renders label, description and one radio per enum value", () => {
    render(<Harness />);

    expect(screen.getByText("Fruit")).toBeDefined();
    expect(screen.getByText("Pick one")).toBeDefined();
    expect(screen.getAllByRole("radio")).toHaveLength(ENUM.length);
    expect(screen.getByText("Apple")).toBeDefined();
    expect(screen.getByText("Banana")).toBeDefined();
    expect(screen.getByText("Cherry")).toBeDefined();
  });

  it("reflects the initial form value as the checked radio", () => {
    render(<Harness defaultValue="banana" />);

    const banana = screen.getByRole("radio", { name: "Banana" });
    expect(banana.getAttribute("aria-checked")).toBe("true");
  });

  it("submits the selected value", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("radio", { name: "Cherry" }));
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

    expect(
      screen.getByRole("radio", { name: "Apple" }).getAttribute("aria-checked"),
    ).toBe("false");

    reset?.("cherry");

    await waitFor(() => {
      expect(
        screen
          .getByRole("radio", { name: "Cherry" })
          .getAttribute("aria-checked"),
      ).toBe("true");
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
