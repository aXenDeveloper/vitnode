import { cookies } from 'next/headers';
import 'server-only';

export const getUserIdCookie = async () => {
  return (await cookies()).get('vitnode-user-id')?.value;
};

export const getAdminIdCookie = async () => {
  return (await cookies()).get('vitnode-admin-id')?.value;
};
