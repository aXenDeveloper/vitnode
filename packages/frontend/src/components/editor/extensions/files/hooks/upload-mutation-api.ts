'use server';

// import {
//   Core_Editor_Files__Upload,
//   Core_Editor_Files__UploadMutation,
//   Core_Editor_Files__UploadMutationVariables,
// } from '@/graphql/mutations/editor/core_editor_files__upload.generated';
// import { revalidatePath } from 'next/cache';
// import { fetcher } from 'vitnode-frontend/graphql/fetcher';

export const uploadMutationApi = async (formData: FormData) => {
  // const file = formData.get('file') as File;
  // const plugin = formData.get('plugin') as string;
  // const folder = formData.get('folder') as string;
  // try {
  //   const data = await fetcher<
  //     Core_Editor_Files__UploadMutation,
  //     Omit<Core_Editor_Files__UploadMutationVariables, 'file'>
  //   >({
  //     query: Core_Editor_Files__Upload,
  //     variables: {
  //       plugin,
  //       folder,
  //     },
  //     files: [
  //       {
  //         files: file,
  //         variable: 'file',
  //       },
  //     ],
  //   });
  //   revalidatePath('/settings/files', 'page');
  //   return { data };
  // } catch (error) {
  //   const e = error as Error;
  //   return { error: e.message };
  // }
};
