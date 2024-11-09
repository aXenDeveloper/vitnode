'use client';

import { DragAndDropSortableList } from '@/components/drag&drop/sortable-list/list';

import { ItemPermissionsAdminDevPluginAdmin } from './item/item';
import { PermissionsAdminWithI18n } from './permissions-admin';

export const ContentPermissionsAdminDevPluginAdmin = ({
  dataWithI18n,
}: {
  dataWithI18n: PermissionsAdminWithI18n[];
}) => {
  const data = dataWithI18n.map(item => ({
    ...item,
    children: item.permissions.map(child => ({
      ...child,
      children: [],
    })),
  }));

  return (
    <DragAndDropSortableList
      componentItem={(data, parentId) => {
        return (
          <ItemPermissionsAdminDevPluginAdmin
            {...data}
            dataWithI18n={dataWithI18n}
            parentId={parentId?.toString()}
            permissions={data.children}
          />
        );
      }}
      data={data}
      maxDepth={1}
    />
  );
};
