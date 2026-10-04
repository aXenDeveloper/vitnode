import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import z from "zod";

import { AutoForm } from "../auto-form";
import { AutoFormCombobox } from "./combobox";

const fetchMembers = () => [
  { label: "Ada Lovelace", value: "1" },
  { label: "Grace Hopper", value: "2" },
];

const renderMemberForm = (formSchema: z.ZodObject<z.ZodRawShape>) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AutoForm
        fields={[
          {
            id: "member",
            component: props => (
              <AutoFormCombobox
                {...props}
                fetchData={fetchMembers}
                id="member"
                label="Member"
                queryKey={["members"]}
              />
            ),
          },
        ]}
        formSchema={formSchema}
      />
    </QueryClientProvider>,
  );

describe("AutoFormCombobox with a single async value", () => {
  it("starts empty instead of showing undefined", () => {
    renderMemberForm(
      z.object({ member: z.object({ label: z.string(), value: z.string() }) }),
    );

    expect(screen.getByRole("combobox")).toHaveProperty("value", "");
  });

  it("does not mark a required object field as optional", () => {
    renderMemberForm(
      z.object({ member: z.object({ label: z.string(), value: z.string() }) }),
    );

    expect(screen.queryByText("core.global.optional")).toBeNull();
  });

  it("still marks an optional object field as optional", () => {
    renderMemberForm(
      z.object({
        member: z.object({ label: z.string(), value: z.string() }).optional(),
      }),
    );

    expect(screen.getByText("core.global.optional")).toBeDefined();
  });
});
