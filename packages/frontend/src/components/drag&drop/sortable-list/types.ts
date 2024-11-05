export interface TreeItem<T> {
  children: TreeItem<T>[];
  collapsed?: boolean;
  id: number | string;
}

export type FlattenedItem<T> = {
  depth: number;
  index: number;
  parentId: null | number | string;
} & T;
