export interface SearchResultItem {
  author: null | {
    avatarColor: string;
    id: number;
    name: string;
    nameCode: string;
  };
  authorId: null | number;
  containerId: null | number;
  containerType: null | string;
  content: string;
  createdAt: Date | string;
  id: number;
  itemId: number;
  itemType: string;
  languageCode: string;
  metadata: Record<string, unknown>;
  pluginId: string;
  score: null | number;
  title: string;
  url: null | string;
}

export interface SearchFeedPage {
  edges: SearchResultItem[];
  pageInfo: {
    count: number;
    endCursor: null | number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: null | number;
    totalCount: number;
  };
}
