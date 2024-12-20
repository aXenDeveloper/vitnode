'use server';

import { revalidatePath } from 'next/cache';

import { checkConnectionApi } from '../../check-connection-api';

export const revalidateApi = async () => {
  await checkConnectionApi();

  revalidatePath('/', 'layout');
};
