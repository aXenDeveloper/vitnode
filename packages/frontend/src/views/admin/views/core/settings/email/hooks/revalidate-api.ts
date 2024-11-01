'use server';

import { revalidatePath } from 'next/cache';

export const revalidateApi = async () => {
  await new Promise<void>((resolve, reject) => {
    try {
      revalidatePath(
        '/[locale]/admin/(auth)/(vitnode)/core/settings/email',
        'page',
      );
      resolve();
    } catch (error) {
      new reject(error);
    }
  });
};
