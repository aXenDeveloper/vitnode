"use server";

import { fetcher } from "@/graphql/fetcher";
import {
  Admin_Settings__General__Edit,
  type Admin_Settings__General__EditMutation,
  type Admin_Settings__General__EditMutationVariables
} from "@/graphql/hooks";

export const mutationApi = async (
  variables: Admin_Settings__General__EditMutationVariables
) => {
  try {
    const { data } = await fetcher<
      Admin_Settings__General__EditMutation,
      Admin_Settings__General__EditMutationVariables
    >({
      query: Admin_Settings__General__Edit,
      variables
    });

    return { data };
  } catch (error) {
    return { error };
  }
};
