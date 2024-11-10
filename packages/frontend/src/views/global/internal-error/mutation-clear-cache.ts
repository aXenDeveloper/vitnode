'use server';

import { revalidatePath } from 'next/cache';

export const mutationClearCache = async () => {
  revalidatePath('/', 'layout');

  return Promise.resolve('Cache cleared');
};
