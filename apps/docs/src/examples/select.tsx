"use client";

import { AutoForm } from "@vitnode/core/components/form/auto-form";
import { AutoFormSelect } from "@vitnode/core/components/form/fields/select";
import { z } from "zod";

export default function SelectExample() {
  const formSchema = z.object({
    options: z.enum(["option1", "option2", "option3"]).default("option1"),
  });

  return (
    <AutoForm
      fields={[
        {
          id: "options",
          component: props => (
            <AutoFormSelect
              description="Choose one of the options."
              label="Select an option"
              labels={[
                {
                  value: "option1",
                  label: "Option 1",
                },
                {
                  value: "option2",
                  label: "Option 2",
                },
                {
                  value: "option3",
                  label: "Option 3",
                },
              ]}
              {...props}
            />
          ),
        },
      ]}
      formSchema={formSchema}
    />
  );
}
