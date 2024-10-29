import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Loader } from '@/components/ui/loader';
import { TooltipWrapper } from '@/components/ui/tooltip';
import { useTextLang } from '@/hooks/use-text-lang';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { GroupsMembersAdminObj } from 'vitnode-shared/admin/members/groups.dto';

const Content = React.lazy(async () =>
  import('./content').then(module => ({
    default: module.ContentDeleteGroupsMembersDialogAdmin,
  })),
);

export const DeleteGroupsMembersDialogAdmin = (
  props: Pick<GroupsMembersAdminObj['edges'][0], 'id' | 'name' | 'protected'>,
) => {
  const t = useTranslations('admin.members.groups.delete');
  const tCore = useTranslations('core.global');
  const { convertText } = useTextLang();

  if (props.protected) return null;

  return (
    <AlertDialog>
      <TooltipWrapper content={tCore('delete')}>
        <AlertDialogTrigger asChild>
          <Button
            ariaLabel={tCore('delete')}
            size="icon"
            variant="destructiveGhost"
          >
            <Trash2 />
          </Button>
        </AlertDialogTrigger>
      </TooltipWrapper>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {tCore('are_you_absolutely_sure')}
          </AlertDialogTitle>
          <div className="flex flex-col gap-4">
            <AlertDialogDescription>{t('text')}</AlertDialogDescription>
            <AlertDialogDescription>
              {t.rich('form_confirm_text', {
                text: () => (
                  <span className="text-foreground font-semibold">
                    {convertText(props.name)}
                  </span>
                ),
              })}
            </AlertDialogDescription>
          </div>
        </AlertDialogHeader>

        <React.Suspense fallback={<Loader />}>
          <Content {...props} />
        </React.Suspense>
      </AlertDialogContent>
    </AlertDialog>
  );
};
