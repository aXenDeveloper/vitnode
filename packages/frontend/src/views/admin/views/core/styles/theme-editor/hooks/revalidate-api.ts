'use server';

import { revalidatePath } from 'next/cache';

export const revalidateApi = async () => {
  await new Promise<void>((resolve, reject) => {
    try {
      revalidatePath('/', 'layout');
      resolve();
    } catch (error) {
      new reject(error);
    }
  });
};
