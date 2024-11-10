'use client';

import { DragAndDropSortableList } from '@/components/drag&drop/sortable-list/list';
import { useTextLang } from '@/hooks/use-text-lang';
import { ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { toast } from 'sonner';
import { ShowNavStyles } from 'vitnode-shared/nav.dto';

import { ActionsTableNavAdmin } from './actions/actions';
import { mutationChangePositionApi } from './hooks/mutation-change-position-api';

export const TableNavAdmin = ({ edges }: { edges: ShowNavStyles[] }) => {
  const t = useTranslations('admin.core.styles.nav');
  const tCore = useTranslations('core.global.errors');
  const { convertText } = useTextLang();

  return (
    <DragAndDropSortableList
      componentItem={data => {
        return (
          <div className="flex flex-1 items-center justify-between gap-2">
            <div className="flex flex-1 flex-col">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 font-semibold">
                  {convertText(data.name)}
                </span>
              </div>

              <span className="text-muted-foreground line-clamp-2 flex items-center gap-2 text-sm">
                {t('href', { href: data.href })}{' '}
                {data.external && <ExternalLink className="size-4" />}
              </span>

              {data.description.length > 0 && (
                <span className="text-muted-foreground line-clamp-2 text-sm">
                  {convertText(data.description)}
                </span>
              )}
            </div>
            <ActionsTableNavAdmin {...data} />
          </div>
        );
      }}
      data={edges.map(item => ({
        ...item,
        children: item.children.map(child => ({ ...child, children: [] })),
      }))}
      maxDepth={1}
      onDragEnd={async moveTo => {
        try {
          await mutationChangePositionApi({
            id: Number(moveTo.id),
            index_to_move: moveTo.indexToMove,
            parent_id: Number(moveTo.parentId),
          });
        } catch (_) {
          toast.error(tCore('title'), {
            description: tCore('internal_server_error'),
          });
        }
      }}
    />
  );
};
