'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@vitnode/core/components/ui/alert-dialog';
import { Button } from '@vitnode/core/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@vitnode/core/components/ui/tooltip';
import { Trash2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { mutationApi } from './mutation-api';

export const DeleteAction = ({ title, id }: { id: number; title: string }) => {
  const t = useTranslations('@vitnode/blog.admin.posts.delete');
  const tGlobal = useTranslations('core.global');

  return (
    <AlertDialog>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="destructive">
                <Trash2Icon className="size-4" />
              </Button>
            </AlertDialogTrigger>
          </TooltipTrigger>
          <TooltipContent>{t('title')}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t.rich('desc', {
              title: () => (
                <span className="text-foreground font-bold">{title}</span>
              ),
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tGlobal('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              const mutation = await mutationApi(id);
              if (mutation?.error) {
                toast.error(tGlobal('errors.title'), {
                  description: tGlobal('errors.internal_server_error'),
                });

                return;
              }

              toast.success(t('success'), {
                description: title,
              });
            }}
          >
            {t('confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
