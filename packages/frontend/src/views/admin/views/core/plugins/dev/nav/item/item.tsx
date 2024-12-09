import { DragAndDropSortableItem } from '@/components/drag&drop/sortable-list/list';
import { TextAndIconsAsideAdmin } from '@/views/admin/layout/sidebar/sidebar';
import { useTranslations } from 'next-intl';
import { ParentNavAuthAdminObj } from 'vitnode-shared/admin/auth.dto';

import { useDevPluginAdmin } from '../../hooks/use-dev-plugin';
import { ActionsTableNavDevPluginAdmin } from './actions/actions';

export const ItemContentNavDevPluginAdmin = ({
  data,
  parentId,
  textsAndIcons,
  dataFromSSR,
}: {
  data: ParentNavAuthAdminObj;
  dataFromSSR: ParentNavAuthAdminObj[];
  parentId?: string;
  textsAndIcons: TextAndIconsAsideAdmin[];
}) => {
  const { code } = useDevPluginAdmin();
  const tAdmin = useTranslations('admin.core.plugins.dev.nav');
  const langKey = parentId ? `${parentId}_${data.code}` : data.code;
  const textAndIcon = textsAndIcons.find(item => item.id === langKey);
  if (!textAndIcon) return null;

  return (
    <DragAndDropSortableItem
      actions={
        <ActionsTableNavDevPluginAdmin
          data={data}
          dataFromSSR={dataFromSSR}
          parentId={parentId}
          textsAndIcons={textsAndIcons}
        />
      }
      className="flex flex-1 flex-col"
    >
      <span className="flex flex-wrap items-center gap-2 font-semibold">
        {textAndIcon.icon}
        {textAndIcon.text}
      </span>
      <p className="text-muted-foreground text-sm">
        {tAdmin.rich('lang_key', {
          key: () => (
            <span className="text-foreground">{`admin_${code}.nav.${langKey}`}</span>
          ),
        })}
      </p>
      <p className="text-muted-foreground text-sm">
        {tAdmin.rich('link_url_with_link', {
          link: () => (
            <span className="text-foreground">{`/admin/${code}/${parentId ? `${parentId}/` : ''}${data.code}`}</span>
          ),
        })}
      </p>
      {data.keywords.length > 0 && (
        <p className="text-muted-foreground mt-1 text-sm">
          {tAdmin.rich('keywords', {
            keywords: () => (
              <span className="text-foreground">
                {data.keywords.join(', ')}
              </span>
            ),
          })}
        </p>
      )}
    </DragAndDropSortableItem>
  );
};
