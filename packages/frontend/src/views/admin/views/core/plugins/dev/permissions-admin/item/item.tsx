import { AppWindow } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useDevPluginAdmin } from '../../hooks/use-dev-plugin';
import { PermissionsAdminWithI18n } from '../permissions-admin';
import { ActionsItemPermissionsAdminDevPluginAdmin } from './actions/actions';

export const ItemPermissionsAdminDevPluginAdmin = ({
  id,
  name,
  parentId,
  dataWithI18n,
  permissions,
}: PermissionsAdminWithI18n & {
  dataWithI18n: PermissionsAdminWithI18n[];
  parentId: string | undefined;
}) => {
  const t = useTranslations('admin.core.plugins.dev.permissions-admin');
  const { code } = useDevPluginAdmin();

  return (
    <div className="flex flex-1 items-center gap-4">
      <div>
        <span className="flex flex-wrap items-center gap-2">
          {id.startsWith('can_manage_') && <AppWindow />}
          <span className="font-semibold">{name}</span>
        </span>
        <p className="text-muted-foreground text-sm">
          {t.rich('lang_key', {
            key: () => (
              <span className="text-foreground">{`admin_${code}.admin_permissions.${id}`}</span>
            ),
          })}
        </p>
        {id.startsWith('can_manage_') && (
          <p className="text-muted-foreground text-sm">
            {t.rich('page_permission', {
              page: () => (
                <span className="text-foreground">
                  {`/admin/${code}/${id.replace('can_manage_', '').split('_').join('/')}`}
                </span>
              ),
            })}
          </p>
        )}
      </div>

      <ActionsItemPermissionsAdminDevPluginAdmin
        data={{ id, name, permissions }}
        dataWithI18n={dataWithI18n}
        parentId={parentId}
      />
    </div>
  );
};
