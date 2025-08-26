"use server";

import { fetcher } from "@vitnode/core/lib/fetcher";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { categoriesAdminModule } from "../../../../../api/modules/admin/categories/categories.admin.module";
import type { zodCreateCategorySchema } from "../../../../../api/modules/admin/categories/routes/create.route";

export const createMutationApi = async (
  body: z.infer<typeof zodCreateCategorySchema>,
) => {
  const res = await fetcher(categoriesAdminModule, {
    prefixPath: "/admin",
    method: "post",
    module: "categories",
    path: "/",
    args: {
      body,
    },
  });

  if (res.status !== 201) {
    return { error: await res.text() };
  }

  revalidatePath(
    "/[locale]/admin/(auth)/(plugins)/(vitnode-blog)/blog/categories",
    "page",
  );
};

export const editMutationApi = async ({
  id,
  ...body
}: z.infer<typeof zodCreateCategorySchema> & { id: number }) => {
  const res = await fetcher(categoriesAdminModule, {
    prefixPath: "/admin",
    method: "put",
    module: "categories",
    path: "/{id}",
    args: {
      params: {
        id,
      },
      body,
    },
  });

  if (res.status !== 200) {
    return { error: await res.text() };
  }

  revalidatePath(
    "/[locale]/admin/(auth)/(plugins)/(vitnode-blog)/blog/categories",
    "page",
  );
};
