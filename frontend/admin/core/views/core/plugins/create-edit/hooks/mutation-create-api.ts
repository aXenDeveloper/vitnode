"use server";

import { revalidatePath } from "next/cache";

import { fetcher } from "@/graphql/fetcher";
import {
  Admin__Core_Plugins__Create,
  type Admin__Core_Plugins__CreateMutation,
  type Admin__Core_Plugins__CreateMutationVariables
} from "@/graphql/hooks";

export const mutationCreateApi = async (
  variables: Admin__Core_Plugins__CreateMutationVariables
) => {
  try {
    const { data } = await fetcher<
      Admin__Core_Plugins__CreateMutation,
      Admin__Core_Plugins__CreateMutationVariables
    >({
      query: Admin__Core_Plugins__Create,
      variables
    });

    revalidatePath("/admin/core/plugins", "page");

    return { data };
  } catch (error) {
    return { error };
  }
};