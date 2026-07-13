import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type FieldValues, useForm } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Form, FormField } from "@/components/ui/form";

import { AutoFormColor } from "./color";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

vi.mock("react-colorful", () => ({
  HslStringColorPicker: ({
    color,
    onChange,
  }: {
    color?: string;
    onChange?: (value: string) => void;
  }) => (
    <button
      data-testid="picker"
      onClick={() => onChange?.("hsl(200, 50%, 50%)")}
      type="button"
    >
      {color}
    </button>
  ),
}));

const Harness = ({
  onSubmit = vi.fn(),
  defaultValue = "hsl(240, 80%, 60%)",
}: {
  defaultValue?: string;
  onSubmit?: (values: FieldValues) => void;
}) => {
  const form = useForm({
    defaultValues: { color: defaultValue } as FieldValues,
  });

  return (
    <Form form={form} onSubmit={onSubmit}>
      <FormField
        control={form.control}
        name="color"
        render={({ field }) => (
          <AutoFormColor
            allowRemoveColor
            field={field}
            label="Color"
            otherProps={{ isOptional: false }}
          />
        )}
      />
      <button type="submit">submit</button>
    </Form>
  );
};

describe("AutoFormColor", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the label and the current color on the trigger", () => {
    render(<Harness />);

    expect(screen.getByText("Color")).toBeDefined();
    expect(screen.getByText("hsl(240, 80%, 60%)")).toBeDefined();
  });

  it("shows the pick-color placeholder when no color is set", () => {
    render(<Harness defaultValue="" />);

    expect(screen.getByText("pick_color")).toBeDefined();
  });

  it("writes the picked HSL color into the form and submits it", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    fireEvent.click(screen.getByText("hsl(240, 80%, 60%)"));
    fireEvent.click(await screen.findByTestId("picker"));

    fireEvent.click(screen.getByRole("button", { name: "submit" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        { color: "hsl(200, 50%, 50%)" },
        expect.anything(),
      );
    });
  });

  it("lets the user type a color in any format via the text input", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    fireEvent.click(screen.getByText("hsl(240, 80%, 60%)"));
    const input = await screen.findByRole<HTMLInputElement>("textbox");
    fireEvent.change(input, { target: { value: "#00ff00" } });

    fireEvent.click(screen.getByRole("button", { name: "submit" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        { color: "#00ff00" },
        expect.anything(),
      );
    });
  });

  it("clears the value via the remove button when allowRemoveColor is set", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    fireEvent.click(screen.getByText("hsl(240, 80%, 60%)"));
    fireEvent.click(await screen.findByRole("button", { name: "remove" }));

    fireEvent.click(screen.getByRole("button", { name: "submit" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ color: "" }, expect.anything());
    });
  });
});
