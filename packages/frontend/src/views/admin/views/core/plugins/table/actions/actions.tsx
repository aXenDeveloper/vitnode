import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TooltipWrapper } from '@/components/ui/tooltip';
import { CONFIG } from '@/helpers/config-with-env';
import { Link, usePathname } from '@/navigation';
import { BadgeHelp, ChevronDown, CodeXml, Trash2, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { ShowPluginAdmin } from 'vitnode-shared/admin/plugins.dto';

import { DeletePluginActionsAdmin } from './delete/delete';
import { SetDefaultPluginActionsAdmin } from './set-default/set-default';

export const ActionsItemPluginsAdmin = (props: ShowPluginAdmin) => {
  const t = useTranslations('admin.core.plugins');
  const tCore = useTranslations('core.global');
  const pathname = usePathname();

  const [isOpenDeleteDialog, setIsOpenDeleteDialog] = React.useState(false);
  const [isOpenUploadDialog, setIsOpenUploadDialog] = React.useState(false);

  return (
    <>
      {!props.default &&
        props.enabled &&
        (props.allow_default || CONFIG.node_development) && (
          <SetDefaultPluginActionsAdmin {...props} />
        )}

      <TooltipWrapper content={t('get_help')}>
        <Button ariaLabel={t('get_help')} asChild size="icon" variant="ghost">
          <Link
            href={props.support_url}
            rel="noopener noreferrer"
            target="_blank"
          >
            <BadgeHelp />
          </Link>
        </Button>
      </TooltipWrapper>

      {CONFIG.node_development && (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                ariaLabel={tCore('more_actions')}
                size="icon"
                variant="ghost"
              >
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-52">
              <DropdownMenuItem
                onClick={() => {
                  setIsOpenUploadDialog(true);
                }}
              >
                <Upload /> {t('upload_new_version')}
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <Link href={`${pathname}/${props.code}/dev`}>
                  <CodeXml /> {t('dev_tools')}
                </Link>
              </DropdownMenuItem>

              {!props.default && (
                <DropdownMenuItem
                  destructive
                  onClick={() => {
                    setIsOpenDeleteDialog(true);
                  }}
                >
                  <Trash2 /> {tCore('delete')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* <UploadPluginActionsAdmin
            open={isOpenUploadDialog}
            setOpen={setIsOpenUploadDialog}
            {...props}
          /> */}

          {!props.default && (
            <DeletePluginActionsAdmin
              open={isOpenDeleteDialog}
              setOpen={setIsOpenDeleteDialog}
              {...props}
            />
          )}
        </>
      )}
    </>
  );
};
