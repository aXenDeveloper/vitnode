import { fetcher } from '@/api/fetcher';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AvatarUser } from '@/components/ui/user/avatar';
import { GroupFormat } from '@/components/ui/user/group-format';
import { Link } from '@/navigation';
import { SquareArrowOutUpRight } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { UserMembersAdmin } from 'vitnode-shared/admin/members/users.dto';

import { ActionsUserMembersAdmin } from './actions/actions';
import { InfoBlockUserMembersAdmin } from './blocks/info';

const getData = async (id: number) => {
  try {
    const { data } = await fetcher<UserMembersAdmin>({
      url: `/admin/members/users/${id}`,
    });

    return data;
  } catch (e) {
    const error = e as Error;
    if (error.message.includes('404')) {
      notFound();
    }

    throw error;
  }
};

interface Props {
  params: Promise<{ id: string }>;
}

export const generateMetadataUserMembersAdmin = async ({ params }: Props) => {
  const { id } = await params;
  const { name } = await getData(+id);

  return {
    title: name,
  };
};

export const UserMembersAdminView = async ({ params }: Props) => {
  const { id } = await params;
  const [t, data] = await Promise.all([
    getTranslations('admin.members.users.item'),
    getData(+id),
  ]);
  const { name, group, name_seo } = data;

  return (
    <div className="space-y-8">
      <Card className="@container">
        <div className="bg-secondary h-20 rounded-t-md" />
        <div className="@lg:flex-row @lg:text-left @lg:mt-0 relative -mt-14 flex flex-col items-center gap-6 p-4 text-center">
          <div className="basis-24">
            <AvatarUser
              className="border-card @lg:bottom-4 @lg:left-auto @lg:translate-x-0 absolute bottom-auto left-1/2 -mb-2 -translate-x-1/2 border-4"
              sizeInRem={6}
              user={data}
            />
          </div>

          <div className="flex-1">
            <h1 className="truncate text-2xl font-semibold">{name}</h1>
            <GroupFormat group={group} />
          </div>

          <Button asChild variant="outline">
            <Link href={`/profile/${name_seo}`} target="_blank">
              {t('public_profile')} <SquareArrowOutUpRight />
            </Link>
          </Button>

          <ActionsUserMembersAdmin {...data} />
        </div>
      </Card>

      <InfoBlockUserMembersAdmin {...data} />
    </div>
  );
};
