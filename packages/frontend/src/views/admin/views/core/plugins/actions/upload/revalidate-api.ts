'use server';

import { checkConnectionApi } from '../../check-connection-api';

export const revalidateApi = async () => {
  await checkConnectionApi();
};
