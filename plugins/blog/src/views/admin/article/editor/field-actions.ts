import React from "react";

export type ArticleFieldActions = Partial<Record<string, React.ReactNode>>;

export const ArticleFieldActionsContext =
  React.createContext<ArticleFieldActions>({});

export const useArticleFieldAction = (name: string): React.ReactNode =>
  React.use(ArticleFieldActionsContext)[name];
