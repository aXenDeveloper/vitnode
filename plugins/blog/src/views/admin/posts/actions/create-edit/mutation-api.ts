"use server";

import { fetcher } from "@vitnode/core/lib/fetcher";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { postsAdminModule } from "@/api/modules/admin/posts/posts.admin.module";
import type { zodCreatePostSchema } from "@/api/modules/admin/posts/routes/create.route";

export const createMutationApi = async (
  body: z.infer<typeof zodCreatePostSchema>,
) => {
  const res = await fetcher(postsAdminModule, {
    prefixPath: "/admin",
    method: "post",
    module: "posts",
    path: "/",
    args: {
      body,
    },
  });

  if (res.status !== 201) {
    return { error: await res.text() };
  }

  revalidatePath(
    "/[locale]/admin/(auth)/(plugins)/(vitnode-blog)/blog/posts",
    "page",
  );
};

export const editMutationApi = async ({
  id,
  ...body
}: z.infer<typeof zodCreatePostSchema> & { id: number }) => {
  const res = await fetcher(postsAdminModule, {
    prefixPath: "/admin",
    method: "put",
    module: "posts",
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
    "/[locale]/admin/(auth)/(plugins)/(vitnode-blog)/blog/posts",
    "page",
  );
};
