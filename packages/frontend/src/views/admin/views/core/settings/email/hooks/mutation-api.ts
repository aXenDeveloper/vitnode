'use server';

export const mutationApi = async () => {
  // const variables: Admin__Core_Email_Settings__EditMutationVariables = {
  //   colorPrimary: formData.get('color_primary') as string,
  //   colorPrimaryForeground: formData.get('color_primary_foreground') as string,
  //   logo: {
  //     keep: formData.get('logo.keep') === 'true',
  //   },
  // };
  // const logo = formData.get('logo.file') as File;
  // try {
  //   await fetcher<
  //     Admin__Core_Email_Settings__EditMutation,
  //     Admin__Core_Email_Settings__EditMutationVariables
  //   >({
  //     query: Admin__Core_Email_Settings__Edit,
  //     variables,
  //     files: [
  //       {
  //         variable: 'logo.file',
  //         files: logo,
  //       },
  //     ],
  //   });
  //   revalidatePath(
  //     '/[locale]/admin/(auth)/(vitnode)/core/settings/email',
  //     'page',
  //   );
  // } catch (error) {
  //   const e = error as Error;
  //   return { error: e.message };
  // }
};
