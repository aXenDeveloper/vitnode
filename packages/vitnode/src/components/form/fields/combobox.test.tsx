import type { ReactElement } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ItemAutoFormComponentProps } from "../auto-form";

import { AutoFormCombobox } from "./combobox";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/components/ui/form", () => ({
  FormMessage: () => null,
  useFormField: () => ({
    error: undefined,
    formDescriptionId: "form-item-description",
    formItemId: "form-item",
    formMessageId: "form-item-message",
  }),
}));

afterEach(() => {
  vi.useRealTimers();
});

const createField = (
  value: unknown = null,
): ItemAutoFormComponentProps["field"] => {
  return {
    value,
    onChange: vi.fn(),
    onBlur: vi.fn(),
    name: "field",
    ref: vi.fn(),
  };
};

const renderWithClient = (ui: ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
};

describe("AutoFormCombobox", () => {
  it("uses the translated default placeholder when no placeholder is provided", () => {
    renderWithClient(
      <AutoFormCombobox
        field={createField()}
        otherProps={{
          enum: ["option-one"],
          isOptional: false,
          "aria-invalid": false,
        }}
      />,
    );

    expect(screen.getByPlaceholderText("select_option")).toBeTruthy();
  });

  it("renders label and placeholder for static options", () => {
    renderWithClient(
      <AutoFormCombobox
        field={createField()}
        label="Type"
        otherProps={{
          enum: ["option-one", "option-two"],
          isOptional: false,
          "aria-invalid": false,
        }}
        placeholder="Pick a type"
      />,
    );

    expect(screen.getByText("Type")).toBeTruthy();
    expect(screen.getByPlaceholderText("Pick a type")).toBeTruthy();
  });

  it("renders optional marker, labelRight and description", () => {
    renderWithClient(
      <AutoFormCombobox
        description="Choose the primary item type."
        field={createField()}
        label="Type"
        labelRight={<span>Admin only</span>}
        otherProps={{
          enum: ["option-one"],
          isOptional: true,
          "aria-invalid": false,
        }}
      />,
    );

    expect(screen.getByText("Type")).toBeTruthy();
    expect(screen.getByText("optional")).toBeTruthy();
    expect(screen.getByText("Admin only")).toBeTruthy();
    expect(screen.getByText("Choose the primary item type.")).toBeTruthy();
  });

  it("passes disabled and invalid state to the single input", () => {
    renderWithClient(
      <AutoFormCombobox
        disabled
        field={createField()}
        otherProps={{
          enum: ["option-one"],
          isOptional: false,
          "aria-invalid": true,
        }}
        placeholder="Pick a type"
      />,
    );

    const input = screen.getByPlaceholderText("Pick a type");

    expect((input as HTMLInputElement).disabled).toBe(true);
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("renders chips when multiple for static options", () => {
    const { container } = renderWithClient(
      <AutoFormCombobox
        field={createField([])}
        label="Tags"
        multiple
        otherProps={{
          enum: ["one", "two"],
          isOptional: false,
          "aria-invalid": false,
        }}
      />,
    );

    expect(
      container.querySelector("[data-slot='combobox-chips']"),
    ).toBeTruthy();
  });

  it("renders mapped labels for selected values", () => {
    renderWithClient(
      <AutoFormCombobox
        field={createField(["option-one"])}
        labels={[{ label: "Option One", value: "option-one" }]}
        multiple
        otherProps={{
          enum: ["option-one"],
          isOptional: false,
          "aria-invalid": false,
        }}
      />,
    );

    expect(screen.getByText("Option One")).toBeTruthy();
  });

  it("falls back to raw selected values when labels are missing", () => {
    renderWithClient(
      <AutoFormCombobox
        field={createField(["unknown-option"])}
        multiple
        otherProps={{
          enum: ["unknown-option"],
          isOptional: false,
          "aria-invalid": false,
        }}
      />,
    );

    expect(screen.getByText("unknown-option")).toBeTruthy();
  });

  it("calls onInputValueChange for static input", () => {
    const onInputValueChange = vi.fn();

    renderWithClient(
      <AutoFormCombobox
        field={createField()}
        label="Type"
        onInputValueChange={onInputValueChange}
        otherProps={{
          enum: ["option-one"],
          isOptional: false,
          "aria-invalid": false,
        }}
        placeholder="Pick a type"
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Pick a type"), {
      target: {
        value: "opt",
      },
    });

    expect(onInputValueChange).toHaveBeenCalled();
  });

  it("calls field.onChange and onValueChange when a static option is selected", async () => {
    const field = createField();
    const onValueChange = vi.fn();

    renderWithClient(
      <AutoFormCombobox
        field={field}
        onValueChange={onValueChange}
        otherProps={{
          enum: ["option-one", "option-two"],
          isOptional: false,
          "aria-invalid": false,
        }}
        placeholder="Pick a type"
      />,
    );

    const input = screen.getByPlaceholderText("Pick a type");

    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(field.onChange).toHaveBeenCalledWith("option-one");
    });
    expect(onValueChange).toHaveBeenCalledWith("option-one", expect.anything());
  });

  it("loads async options and ignores multiple", async () => {
    const fetchData = vi
      .fn()
      .mockResolvedValue([{ label: "Category", value: "1" }]);
    const { container } = renderWithClient(
      <AutoFormCombobox
        fetchData={fetchData}
        field={createField()}
        id="categoryId"
        label="Category"
        multiple
        otherProps={{
          isOptional: false,
          "aria-invalid": false,
        }}
        searchPlaceholder="Search categories"
      />,
    );

    await waitFor(() => {
      expect(fetchData).toHaveBeenCalledWith({ search: "" });
    });

    expect(screen.getByPlaceholderText("Search categories")).toBeTruthy();
    expect(container.querySelector("[data-slot='combobox-chips']")).toBeNull();
  });

  it("uses placeholder as async search placeholder fallback", async () => {
    const fetchData = vi.fn().mockResolvedValue([]);

    renderWithClient(
      <AutoFormCombobox
        fetchData={fetchData}
        field={createField()}
        id="categoryId"
        otherProps={{
          isOptional: false,
          "aria-invalid": false,
        }}
        placeholder="Search from placeholder"
      />,
    );

    await waitFor(() => {
      expect(fetchData).toHaveBeenCalledWith({ search: "" });
    });

    expect(screen.getByPlaceholderText("Search from placeholder")).toBeTruthy();
  });

  it("forwards async input changes without refetching immediately", async () => {
    const fetchData = vi.fn().mockResolvedValue([]);
    const onInputValueChange = vi.fn();

    renderWithClient(
      <AutoFormCombobox
        fetchData={fetchData}
        field={createField()}
        id="categoryId"
        onInputValueChange={onInputValueChange}
        otherProps={{
          isOptional: false,
          "aria-invalid": false,
        }}
        searchPlaceholder="Search categories"
      />,
    );

    await waitFor(() => {
      expect(fetchData).toHaveBeenCalledWith({ search: "" });
    });

    const input = screen.getByPlaceholderText("Search categories");

    fireEvent.input(input, {
      target: {
        value: "cat",
      },
    });

    expect(onInputValueChange).toHaveBeenCalledWith("cat", expect.anything());
    expect(fetchData).not.toHaveBeenCalledWith({ search: "cat" });
  });
});
