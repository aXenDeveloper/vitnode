'use client';

import {
  closestCenter,
  defaultDropAnimation,
  DndContext,
  DragEndEvent,
  DragMoveEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  MeasuringStrategy,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslations } from 'next-intl';
import React, { useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { flattenTree } from './flat';
import { SortableTreeItem } from './item';
import { FlattenedItem, TreeItem } from './types';
import {
  buildTree,
  getChildCount,
  getProjection,
  removeChildrenOf,
  setProperty,
} from './utilities';

const indentationWidth = 50;

export function DragAndDropSortableList<
  T extends TreeItem<Omit<T, '__typename'>>,
>({
  data,
  componentItem,
  onCollapse,
  maxDepth,
  onDragEnd,
}: {
  componentItem: (item: T, parentId: null | number | string) => React.ReactNode;
  data: T[];
  maxDepth?: number;
  onCollapse?: (props: { id: number | string; isOpen: boolean }) => void;
  onDragEnd?: (props: {
    id: number | string;
    indexToMove: number;
    parentId: null | number | string;
  }) => void;
}) {
  const t = useTranslations('core.global');
  const [isReadyDocument, setIsReadyDocument] = useState(false);
  const [items, setItems] = useState(data);
  const [activeId, setActiveId] = useState<null | number | string>(null);
  const [overId, setOverId] = useState<null | number | string>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);
  const id = useId();

  // Refetch data
  useEffect(() => {
    setItems(data);
  }, [data]);

  const flattenedItems = useMemo(() => {
    const flattenedTree = flattenTree(items);
    const collapsedItems = flattenedTree.reduce<(number | string)[]>(
      (acc, { children, collapsed, id }) =>
        collapsed && children.length ? [...acc, id] : acc,
      [],
    );

    return removeChildrenOf(
      flattenedTree,
      activeId ? [activeId, ...collapsedItems] : collapsedItems,
    );
  }, [activeId, items]);

  const projected =
    activeId && overId
      ? getProjection(
          flattenedItems,
          activeId,
          overId,
          offsetLeft,
          indentationWidth,
          maxDepth,
        )
      : null;
  const activeItem = activeId
    ? flattenedItems.find(({ id }) => id === activeId)
    : null;

  const sortedIds = useMemo(
    () => flattenedItems.map(({ id }) => id),
    [flattenedItems],
  );

  function handleDragStart({ active: { id: activeId } }: DragStartEvent) {
    setActiveId(activeId);
    setOverId(activeId);

    document.body.style.setProperty('cursor', 'grabbing');
  }

  function handleDragMove({ delta }: DragMoveEvent) {
    setOffsetLeft(delta.x);
  }

  function handleDragOver({ over }: DragOverEvent) {
    setOverId(over?.id ?? null);
  }

  function resetState() {
    setOverId(null);
    setActiveId(null);
    setOffsetLeft(0);

    document.body.style.setProperty('cursor', '');
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    resetState();
    if (!projected || !over) return;

    const { depth, parentId } = projected;
    const clonedItems: FlattenedItem<Omit<T, '__typename'>>[] = JSON.parse(
      JSON.stringify(flattenTree(items)),
    );
    const overIndex = clonedItems.findIndex(({ id }) => id === over.id);
    const activeIndex = clonedItems.findIndex(({ id }) => id === active.id);
    const activeTreeItem = clonedItems[activeIndex];

    clonedItems[activeIndex] = { ...activeTreeItem, depth, parentId };

    const sortedItems = arrayMove(clonedItems, activeIndex, overIndex);
    const newItems = buildTree<Omit<T, '__typename'>>(sortedItems);

    setItems(newItems as T[]);

    onDragEnd?.({
      id: active.id,
      parentId: parentId,
      indexToMove: overIndex,
    });
  }

  function handleDragCancel() {
    resetState();
  }

  function handleCollapse(id: number | string) {
    const newItems = setProperty<Omit<T, '__typename'>>(
      items,
      id,
      'collapsed',
      value => {
        if (value === undefined) {
          return false;
        }

        return !value;
      },
    );

    onCollapse?.({
      id,
      isOpen: newItems.find(item => item.id === id)?.collapsed ?? true,
    });

    setItems(newItems as T[]);
  }

  useEffect(() => {
    setIsReadyDocument(true);
  }, []);

  if (!data.length) {
    return (
      <div className="text-muted-foreground text-center">{t('no_results')}</div>
    );
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      id={id}
      measuring={{
        droppable: {
          strategy: MeasuringStrategy.Always,
        },
      }}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
      onDragMove={handleDragMove}
      onDragOver={handleDragOver}
      onDragStart={handleDragStart}
    >
      <SortableContext items={sortedIds} strategy={verticalListSortingStrategy}>
        {flattenedItems.map(item => (
          <SortableTreeItem
            collapsed={Boolean(item.collapsed && item.children.length)}
            depth={
              item.id === activeId && projected ? projected.depth : item.depth
            }
            id={item.id}
            indentationWidth={indentationWidth}
            isDragEnd={!!onDragEnd}
            key={item.id}
            onCollapse={
              item.children.length
                ? () => {
                    handleCollapse(item.id);
                  }
                : undefined
            }
          >
            {componentItem(item as unknown as T, item.parentId)}
          </SortableTreeItem>
        ))}
        {isReadyDocument &&
          createPortal(
            <DragOverlay
              dropAnimation={{
                keyframes({ transform }) {
                  return [
                    {
                      opacity: 1,
                      transform: CSS.Transform.toString(transform.initial),
                    },
                    {
                      opacity: 0,
                      transform: CSS.Transform.toString({
                        ...transform.final,
                        x: transform.final.x + 5,
                        y: transform.final.y + 5,
                      }),
                    },
                  ];
                },
                easing: 'ease-out',
                sideEffects({ active }) {
                  active.node.animate([{ opacity: 0 }, { opacity: 1 }], {
                    duration: defaultDropAnimation.duration,
                    easing: defaultDropAnimation.easing,
                  });
                },
              }}
            >
              {activeId && activeItem ? (
                <SortableTreeItem
                  childCount={getChildCount(items, activeId) + 1}
                  clone
                  depth={activeItem.depth}
                  id={activeId}
                  indentationWidth={indentationWidth}
                >
                  {componentItem(
                    activeItem as unknown as T,
                    activeItem.parentId,
                  )}
                </SortableTreeItem>
              ) : null}
            </DragOverlay>,
            document.body,
          )}
      </SortableContext>
    </DndContext>
  );
}
