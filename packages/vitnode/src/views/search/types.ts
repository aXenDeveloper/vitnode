export interface SearchResultAuthor {
  avatarColor: string;
  avatarUrl: null | string;
  id: number;
  name: string;
  nameCode: string;
}

export interface SearchResultItem {
  author: null | SearchResultAuthor;
  authorId: null | number;
  authors?: SearchResultAuthor[];
  containerId: null | number;
  containerType: null | string;
  content: string;
  createdAt: Date | string;
  id: number;
  image?: null | { height?: number; url: string; width?: number };
  isHidden?: boolean;
  isPublic: boolean;
  itemId: number | string;
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
