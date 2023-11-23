import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { cookies } from 'next/headers';

import { GroupsMembersAdminView } from '@/admin/views/members/groups/groups-members-admin-view';
import getQueryClient from '@/functions/get-query-client';
import { fetcher } from '@/graphql/fetcher';
import {
  Show_Admin_Groups,
  Show_Admin_GroupsQuery,
  Show_Admin_GroupsQueryVariables
} from '@/graphql/hooks';
import { APIKeys } from '@/graphql/api-keys';

interface Props {
  params: {
    locale: string;
  };
}

const getData = async () => {
  return await fetcher<Show_Admin_GroupsQuery, Show_Admin_GroupsQueryVariables>({
    query: Show_Admin_Groups,
    variables: {
      first: 10
    },
    headers: {
      Cookie: cookies().toString()
    }
  });
};

export async function generateMetadata({ params: { locale } }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'admin.members.groups' });

  return {
    title: t('title')
  };
}

export default async function Page() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: [APIKeys.GROUPS_MEMBERS, { cursor: null, first: 0, last: null }],
    queryFn: getData
  });
  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrationBoundary state={dehydratedState}>
      <GroupsMembersAdminView />
    </HydrationBoundary>
  );
}