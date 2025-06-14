'use server';

import type { z } from 'zod';

import { revalidatePath } from 'next/cache';

import type { zodSignUpSchema } from '@/api/modules/users/routes/sign-up.route';

import { usersModule } from '@/api/modules/users/users.module';
import { fetcher } from '@/lib/fetcher';
import { redirect } from '@/lib/navigation';

export const mutationApi = async (input: z.infer<typeof zodSignUpSchema>) => {
  const res = await fetcher(usersModule, {
    path: '/sign_up',
    method: 'post',
    module: 'users',
    allowSaveCookies: true,
    args: {
      body: input,
    },
  });

  if (res.status !== 201) {
    return { error: await res.text() };
  }

  const data = await res.json();
  if (data.emailVerified) {
    revalidatePath('/[locale]/(main)', 'layout');
    await redirect('/');
  }

  return { data };
};
