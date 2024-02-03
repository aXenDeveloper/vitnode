'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { fetcher } from '@/graphql/fetcher';
import {
  Core_Nav__Admin__Create,
  type Core_Nav__Admin__CreateMutation,
  type Core_Nav__Admin__CreateMutationVariables
} from '@/graphql/hooks';

export const mutationApi = async (variables: Core_Nav__Admin__CreateMutationVariables) => {
  try {
    const { data } = await fetcher<
      Core_Nav__Admin__CreateMutation,
      Core_Nav__Admin__CreateMutationVariables
    >({
      query: Core_Nav__Admin__Create,
      variables,
      headers: {
        Cookie: cookies().toString()
      }
    });

    revalidatePath('/admin/core/styles/nav', 'page');
    revalidatePath('/', 'layout');

    return { data };
  } catch (error) {
    return { error };
  }
};
