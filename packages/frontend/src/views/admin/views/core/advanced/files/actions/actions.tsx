import { buttonVariants } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CONFIG } from '@/helpers/config-with-env';
import { Link } from '@/navigation';
import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ShowFilesAdvancedAdmin } from 'vitnode-shared/admin/advanced/files.dto';

import { DeleteActionFilesAdvancedCoreAdmin } from './delete/delete';

export const ActionsFilesAdvancedCoreAdmin = (data: ShowFilesAdvancedAdmin) => {
  const t = useTranslations('core.global');

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              aria-label={t('download')}
              className={buttonVariants({
                size: 'icon',
                variant: 'ghost',
              })}
              href={
                data.width && data.height
                  ? `${CONFIG.backend_public_url}/${data.dir_folder}/${data.file_name}`
                  : `${CONFIG.backend_url}/secure_files/${data.id}?security_key=${data.security_key}`
              }
              target="_blank"
            >
              <Download />
            </Link>
          </TooltipTrigger>

          <TooltipContent>{t('download')}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DeleteActionFilesAdvancedCoreAdmin {...data} />
    </>
  );
};
