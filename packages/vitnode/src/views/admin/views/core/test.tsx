"use client";

import { SearchIcon } from "lucide-react";
import { z } from "zod";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormArray } from "@/components/form/fields/array";
import { AutoFormCheckbox } from "@/components/form/fields/checkbox";
import { AutoFormCombobox } from "@/components/form/fields/combobox";
import { AutoFormInput } from "@/components/form/fields/input";
import { AutoFormRadioGroup } from "@/components/form/fields/radio-group";
import { AutoFormSelect } from "@/components/form/fields/select";
import { AutoFormSwitch } from "@/components/form/fields/switch";
import { AutoFormTextarea } from "@/components/form/fields/textarea";
import { Card } from "@/components/ui/card";
import { Editor } from "@/components/ui/editor";
import { EditorContent } from "@/components/ui/editor-content";
import { InputGroupAddon, InputGroupText } from "@/components/ui/input-group";

export const TestView = () => {
  const formSchema = z.object({
    provider: z
      .string()
      .min(1, { message: "Provider is required" })
      .describe(
        "This is the provider for your application. It should be a valid provider name.",
      ),
    features: z
      .array(
        z.object({
          name: z.string().min(1, { message: "Feature name is required" }),
          enabled: z.boolean().default(true),
        }),
      )
      .describe("List the features available for this provider."),
    provider2: z
      .string()
      .describe(
        "This is the provider for your application. It should be a valid provider name.",
      )
      .default("test"),
    client_secret: z
      .string()
      .min(1, { message: "Client Secret is required" })
      .describe(
        "This is the client secret for your application. It should be kept secret and not shared with anyone.",
      ),
    client_secret2: z
      .string()
      .min(1, { message: "Client Secret is required" })
      .describe(
        "This is the client secret for your application. It should be kept secret and not shared with anyone.",
      ),
    terms: z
      .boolean()
      .refine(val => val, {
        message: "You must accept the terms and conditions",
      })
      .describe("By checking this box, you agree to the terms and conditions."),
    options: z.enum(["option1", "option2", "option3"]).default("option1"),
    options_long: z.enum(["option1", "option2", "option3"]).default("option2"),
    switch: z.boolean().default(false).describe("elo"),
    type: z.enum(["option-one", "option-two"]),
    custom_color: z
      .string()
      .default("#000000")
      .describe("Pick your favorite color."),
  });

  return (
    <div className="p-4">
      <Card className="p-6">
        <Editor value="<p>Hello World! 🌎️</p>" />
        <EditorContent content="<h2>Test header v2</h2><p>Hello World! 🌎️das d alfjnasjf kas djksa fkja sfj AFKJ afj AFJKNAJSKGNSAKFLMSAKLDNASFJNKJnjkdasnfjnas fjknsa fjknsafkjn askjfnkajsgnasjkfnskjanf kjans fjknasjkf naskjf naskjnf kjasn kfjans fjkas kfjnas jknfkasjn fkajsnf jnasfjkangaskjfnajsdnlaskmcdasjfnjskafnsajknfcksajdnasjkfnjkasn cfjksanfjckasnjcnaskjcnaksjcnaksjcnakjcnasjkn</p>" />

        <AutoForm
          fields={[
            {
              id: "provider",
              component: props => (
                <AutoFormInput
                  description="This is the provider for your application. It should be a valid provider name."
                  label="Provider"
                  {...props}
                />
              ),
            },
            {
              id: "features",
              component: props => (
                <AutoFormArray
                  {...props}
                  fields={[
                    {
                      id: "name",
                      className: "flex-1",
                      component: subProps => (
                        <AutoFormInput {...subProps} label="Feature Name" />
                      ),
                    },
                    {
                      id: "enabled",
                      component: subProps => (
                        <AutoFormCheckbox {...subProps} label="Enabled" />
                      ),
                    },
                  ]}
                  label="Features"
                />
              ),
            },
            {
              id: "provider2",
              component: props => (
                <AutoFormInput label="Provider 2" {...props}>
                  <InputGroupAddon>
                    <SearchIcon />
                  </InputGroupAddon>
                </AutoFormInput>
              ),
            },
            {
              id: "client_secret",
              component: props => (
                <AutoFormTextarea
                  description="This is the client secret for your application. It should be kept
            secret and not shared with anyone."
                  label="Client Secret"
                  {...props}
                />
              ),
            },
            {
              id: "client_secret2",
              component: props => (
                <AutoFormTextarea
                  description="This is the client secret for your application. It should be kept
            secret and not shared with anyone."
                  label="Client Secret"
                  {...props}
                >
                  <InputGroupAddon align="block-end">
                    <InputGroupText className="tabular-nums">
                      {props.field.value?.toString().length ?? 0} of 500
                      characters
                    </InputGroupText>
                  </InputGroupAddon>
                </AutoFormTextarea>
              ),
            },
            {
              id: "terms",
              component: props => (
                <AutoFormCheckbox
                  description="By checking this box, you agree to the terms and conditions."
                  label="I agree to the terms and conditions"
                  {...props}
                />
              ),
            },
            {
              id: "options",
              component: props => (
                <AutoFormRadioGroup
                  {...props}
                  description="By checking this box, you agree to the terms and conditions."
                  label="I agree to the terms and conditions"
                  labels={[
                    {
                      value: "option1",
                      label: "Option 1",
                      description: "This is the description for option 1",
                    },
                    {
                      value: "option2",
                      label: "Option 2",
                    },
                    {
                      value: "option3",
                      label: "Option 3",
                      description: "This is the description for option 3",
                      disabled: true,
                    },
                  ]}
                  variant="blocks"
                />
              ),
            },
            {
              id: "options_long",
              component: props => (
                <AutoFormSelect
                  {...props}
                  description="By checking this box, you agree to the terms and conditions."
                  label="I agree to the terms and conditions"
                  labels={[
                    {
                      value: "option1",
                      label:
                        "Option 1 with a very long label that should be truncated",
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
                  placeholder="Select an option from the list"
                />
              ),
            },
            {
              id: "switch",
              component: props => (
                <AutoFormSwitch
                  {...props}
                  description="By checking this box, you agree to the terms and conditions."
                  label="I agree to the terms and conditions"
                />
              ),
            },
            {
              id: "type",
              component: props => (
                <AutoFormCombobox
                  description="By checking this box, you agree to the terms and conditions."
                  label="Type"
                  labels={[
                    {
                      value: "option-one",
                      label: "Option One",
                    },
                    {
                      value: "option-two",
                      label: "Option Two",
                    },
                  ]}
                  {...props}
                />
              ),
            },
            {
              id: "custom_color",
              component: props => (
                <div className="flex w-full flex-col gap-3">
                  <div className="text-sm leading-none font-medium">
                    Custom Color Picker
                  </div>
                  <input
                    {...props.field}
                    className="h-10 w-24 cursor-pointer rounded-md border p-1"
                    type="color"
                    value={(props.field.value as string) ?? "#000000"}
                  />
                  {props.description && (
                    <div className="text-muted-foreground text-sm">
                      {props.description}
                    </div>
                  )}
                </div>
              ),
            },
          ]}
          formSchema={formSchema}
          onSubmit={async values => {
            // eslint-disable-next-line no-console
            console.log("Form submitted", values);
            await new Promise(resolve => setTimeout(resolve, 3000));
          }}
        />
      </Card>
    </div>
  );
};
