"use client";

import { AutoForm } from "@vitnode/core/components/form/auto-form";
import { AutoFormCheckbox } from "@vitnode/core/components/form/fields/checkbox";
import { AutoFormInput } from "@vitnode/core/components/form/fields/input";
import { AutoFormSelect } from "@vitnode/core/components/form/fields/select";
import { AutoFormTextarea } from "@vitnode/core/components/form/fields/textarea";
import { InputGroupAddon } from "@vitnode/core/components/ui/input-group";
import { Search } from "lucide-react";
import { z } from "zod";

export default function AutoFormExample() {
  const formSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    email: z
      .email("Please enter a valid email address")
      .describe("We'll use this email to contact you. (from zod schema)"),
    user_type: z.enum(["admin", "editor", "viewer"]),
    accept_terms: z.boolean().refine(val => val, {
      message: "You must accept the terms and conditions",
    }),
    description: z
      .string()
      .min(10, "Description must be at least 10 characters"),
    search: z.string().optional(),
  });

  return (
    <AutoForm
      fields={[
        {
          id: "username",
          component: props => (
            <AutoFormInput
              description="This is the username for your application. It should be unique and not shared with anyone."
              label="Username"
              {...props}
            />
          ),
        },
        {
          id: "email",
          component: props => (
            <AutoFormInput label="Email Address" {...props} />
          ),
        },
        {
          id: "user_type",
          component: props => (
            <AutoFormSelect
              description="Select the type of user."
              label="User Type"
              labels={[
                { value: "admin", label: "Admin" },
                { value: "editor", label: "Editor" },
                { value: "viewer", label: "Viewer" },
              ]}
              {...props}
            />
          ),
        },
        {
          id: "accept_terms",
          component: props => (
            <AutoFormCheckbox
              label="I accept the terms and conditions"
              {...props}
            />
          ),
        },
        {
          id: "description",
          component: props => (
            <AutoFormTextarea
              description="Write a short description of your application."
              label="Description"
              placeholder="My application is..."
              {...props}
            />
          ),
        },
        {
          id: "search",
          component: props => (
            <AutoFormInput {...props} label="Search" placeholder="Search...">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupAddon align="inline-end">12 results</InputGroupAddon>
            </AutoFormInput>
          ),
        },
      ]}
      formSchema={formSchema}
    />
  );
}
