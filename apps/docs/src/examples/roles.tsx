"use client";

import type { RoleOption } from "@vitnode/core/components/form/fields/search-roles.action.server";

import { AutoForm } from "@vitnode/core/components/form/auto-form";
import { AutoFormRoles } from "@vitnode/core/components/form/fields/input-roles";
import { z } from "zod";

const formSchema = z.object({
  roleId: z.number(),
  roleIds: z.array(z.number()),
});

const ROLES: RoleOption[] = [
  {
    color: "#ef4444",
    id: 1,
    name: [{ languageCode: "en", name: "Administrator" }],
  },
  { color: "#3b82f6", id: 2, name: [{ languageCode: "en", name: "Editor" }] },
  { color: null, id: 3, name: [{ languageCode: "en", name: "Member" }] },
];

const search = async (value: string) =>
  Promise.resolve(
    ROLES.filter(role =>
      role.name[0].name.toLowerCase().includes(value.toLowerCase()),
    ),
  );

export default function RolesExample() {
  return (
    <AutoForm
      fields={[
        {
          id: "roleId",
          component: props => (
            <AutoFormRoles
              {...props}
              description="One role, replaced each time you pick."
              label="Primary role"
              placeholder="Select a role"
              search={search}
            />
          ),
        },
        {
          id: "roleIds",
          component: props => (
            <AutoFormRoles
              {...props}
              description="Pick as many as you like. Picking one twice removes it."
              label="Additional roles"
              multiple
              placeholder="Add a role"
              search={search}
            />
          ),
        },
      ]}
      formSchema={formSchema}
    />
  );
}
