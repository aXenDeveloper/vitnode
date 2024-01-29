import { cookies } from 'next/headers';

import { ForumsForumView } from '@/themes/1/forum/views/forum/forums/forums-forum-view';
import { fetcher } from '@/graphql/fetcher';
import {
  Forum_Forums__Show,
  type Forum_Forums__ShowQuery,
  type Forum_Forums__ShowQueryVariables
} from '@/graphql/hooks';

const getData = async () => {
  const { data } = await fetcher<Forum_Forums__ShowQuery, Forum_Forums__ShowQueryVariables>({
    query: Forum_Forums__Show,
    headers: {
      Cookie: cookies().toString()
    },
    cache: 'force-cache'
  });

  return data;
};

export default async function Page() {
  const data = await getData();

  return <ForumsForumView data={data} />;
}
