export type FlattenedItem<T> = T & {
  depth: number;
  index: number;
  parentId: null | number | string;
};

export interface TreeItem<T> {
  children: TreeItem<T>[];
  collapsed?: boolean;
  id: number | string;
}
