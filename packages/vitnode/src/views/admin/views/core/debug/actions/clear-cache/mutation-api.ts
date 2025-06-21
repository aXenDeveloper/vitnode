'use server';

import { revalidatePath } from 'next/cache';

export const clearCacheMutation = async () => {
  await Promise.resolve(revalidatePath('/', 'layout'));
};
