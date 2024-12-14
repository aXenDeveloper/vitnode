import { buttonVariants } from '@/components/ui/button';
import { TooltipWrapper } from '@/components/ui/tooltip';
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
      <TooltipWrapper content={t('download')}>
        <Link
          aria-label={t('download')}
          className={buttonVariants({
            size: 'icon',
            variant: 'ghost',
          })}
          href={`${CONFIG.backend_public_url}/${data.dir_folder}/${data.file_name}`}
          target="_blank"
        >
          <Download />
        </Link>
      </TooltipWrapper>

      <DeleteActionFilesAdvancedCoreAdmin {...data} />
    </>
  );
};
