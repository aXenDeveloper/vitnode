import { createServerFn } from "@tanstack/react-start";
import { readAdminUserSearchOnApi } from "@vitnode/core/tanstack/admin/server";
import { z } from "zod";


const adminUserSearchInput = z.object({
  search: z.string().trim().min(1).max(128),
});

export const adminUserSearchFn = createServerFn({ method: "POST" })
  .validator(adminUserSearchInput)
  .handler(async ({ data }) => await readAdminUserSearchOnApi(data.search));
