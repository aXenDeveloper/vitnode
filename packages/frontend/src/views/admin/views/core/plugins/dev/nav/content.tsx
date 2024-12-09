'use client';

import { DragAndDropSortableList } from '@/components/drag&drop/sortable-list/list';
import { TextAndIconsAsideAdmin } from '@/views/admin/layout/sidebar/sidebar';
import { useTranslations } from 'next-intl';
import React from 'react';
import { toast } from 'sonner';
import { ParentNavAuthAdminObj } from 'vitnode-shared/admin/auth.dto';

import { useDevPluginAdmin } from '../hooks/use-dev-plugin';
import { mutationChangePositionApi } from './hooks/mutation-change-position-api';
import { ItemContentNavDevPluginAdmin } from './item/item';

export const ContentNavDevPluginAdmin = ({
  data,
  textsAndIcons,
}: {
  data: ParentNavAuthAdminObj[];
  textsAndIcons: TextAndIconsAsideAdmin[];
}) => {
  const t = useTranslations('core.global.errors');
  const { code } = useDevPluginAdmin();

  return (
    <DragAndDropSortableList
      componentItem={(item, parentId) => {
        return (
          <ItemContentNavDevPluginAdmin
            data={item}
            dataFromSSR={data}
            parentId={parentId?.toString()}
            textsAndIcons={textsAndIcons}
          />
        );
      }}
      data={data.map(item => ({
        ...item,
        children:
          item.children?.map(child => ({
            ...child,
            id: child.code,
            children: [],
          })) ?? [],
        id: item.code,
      }))}
      maxDepth={1}
      onDragEnd={async moveTo => {
        try {
          await mutationChangePositionApi({
            code: moveTo.id.toString(),
            plugin_code: code,
            index_to_move: moveTo.indexToMove,
            parent_code: moveTo.parentId?.toString(),
          });
        } catch (_) {
          toast.error(t('title'), {
            description: t('internal_server_error'),
          });
        }
      }}
    />
  );
};
