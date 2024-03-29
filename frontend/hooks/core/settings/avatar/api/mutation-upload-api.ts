"use server";

import { revalidateTag } from "next/cache";

import { fetcher } from "@/graphql/fetcher";
import {
  Core_Members__Avatar__Upload,
  type Core_Members__Avatar__UploadMutation,
  type Core_Members__Avatar__UploadMutationVariables
} from "@/graphql/hooks";

export const mutationUploadApi = async (formData: FormData) => {
  try {
    const files = formData.get("file") as File;

    const { data } = await fetcher<
      Core_Members__Avatar__UploadMutation,
      Core_Members__Avatar__UploadMutationVariables
    >({
      query: Core_Members__Avatar__Upload,
      uploads: [
        {
          files,
          variable: "file"
        }
      ]
    });

    revalidateTag("Core_Sessions__Authorization");

    return { data };
  } catch (error) {
    return { error };
  }
};
