import { FlattenedItem, TreeItem } from './types';

function flatten<T extends TreeItem<T>>(
  items: T[],
  parentId: null | number | string = null,
  depth = 0,
): FlattenedItem<T>[] {
  return items.reduce<FlattenedItem<T>[]>((acc, item, index) => {
    const newItem: FlattenedItem<T> = {
      ...item,
      parentId,
      depth,
      index,
      collapsed: item.collapsed ?? true,
    };

    return [
      ...acc,
      newItem,
      ...flatten(item.children as T[], item.id, depth + 1),
    ];
  }, []);
}

export function flattenTree<T extends TreeItem<T>>(
  items: T[],
): FlattenedItem<T>[] {
  return flatten(items);
}
