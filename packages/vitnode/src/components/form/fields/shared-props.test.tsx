import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import React from "react";
import { type FieldValues, useForm } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Form, FormField } from "@/components/ui/form";

import type { ItemAutoFormComponentProps } from "../auto-form";

import { AutoFormCheckbox } from "./checkbox";
import { AutoFormColor } from "./color";
import { AutoFormCombobox } from "./combobox";
import { AutoFormDateTime } from "./date-time";
import { AutoFormNullableNumber } from "./nullable-number";
import { AutoFormRadioGroup } from "./radio-group";
import { AutoFormSelect } from "./select";
import { AutoFormSwitch } from "./switch";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

const FIELDS: {
  name: string;
  render: (props: ItemAutoFormComponentProps) => React.ReactNode;
}[] = [
  {
    name: "AutoFormCheckbox",
    render: props => <AutoFormCheckbox {...props} />,
  },
  { name: "AutoFormColor", render: props => <AutoFormColor {...props} /> },
  {
    name: "AutoFormCombobox",
    render: props => (
      <AutoFormCombobox
        fetchData={async () => await Promise.resolve([])}
        id="combobox"
        {...props}
      />
    ),
  },
  {
    name: "AutoFormDateTime",
    render: props => <AutoFormDateTime {...props} />,
  },
  {
    name: "AutoFormNullableNumber",
    render: props => <AutoFormNullableNumber toggleLabel="Off" {...props} />,
  },
  {
    name: "AutoFormRadioGroup",
    render: props => <AutoFormRadioGroup {...props} />,
  },
  { name: "AutoFormSelect", render: props => <AutoFormSelect {...props} /> },
  { name: "AutoFormSwitch", render: props => <AutoFormSwitch {...props} /> },
];

const Harness = ({
  component,
}: {
  component: (props: ItemAutoFormComponentProps) => React.ReactNode;
}) => {
  const form = useForm({ defaultValues: { value: undefined } as FieldValues });
  // The async combobox reads its options through react-query.
  const [queryClient] = React.useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <Form form={form} onSubmit={vi.fn()}>
        <FormField
          control={form.control}
          name="value"
          render={({ field }) => (
            <>
              {component({
                field,
                label: "Field",
                multiLang: false,
                otherProps: { enum: ["one", "two"], isOptional: false },
              })}
            </>
          )}
        />
      </Form>
    </QueryClientProvider>
  );
};

describe("AutoForm fields that are not language-aware", () => {
  let errors: string[] = [];

  beforeEach(() => {
    errors = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(FIELDS)("$name keeps multiLang off the DOM", ({ render: field }) => {
    render(<Harness component={field} />);

    expect(errors.filter(error => error.includes("multiLang"))).toEqual([]);
  });
});
