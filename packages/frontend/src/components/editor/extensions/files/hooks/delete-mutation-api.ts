'use server';

// import { fetcher } from '@/graphql/fetcher';
// import {
//   Core_Editor_Files__Delete,
//   Core_Editor_Files__DeleteMutation,
//   Core_Editor_Files__DeleteMutationVariables,
// } from '@/graphql/mutations/editor/core_editor_files__delete.generated';
import { revalidatePath } from 'next/cache';

export const deleteMutationApi = async () =>
  // variables: Core_Editor_Files__DeleteMutationVariables,
  {
    // try {
    //   await fetcher<
    //     Core_Editor_Files__DeleteMutation,
    //     Core_Editor_Files__DeleteMutationVariables
    //   >({
    //     query: Core_Editor_Files__Delete,
    //     variables,
    //   });
    // } catch (error) {
    //   const e = error as Error;
    //   return { error: e.message };
    // }
    // revalidatePath('/settings/files', 'page');
  };
