import type { CSSProperties } from "react";

const MORPH_CLASS = "vitnode-blog-morph";
const CATEGORIES_NAME = "vitnode-blog-categories";
const RECENT_MS = 1000;

const state = { categorySwitchAt: 0, postId: null as null | number };

const coverName = (postId: number) => `vitnode-blog-cover-${postId}`;
const titleName = (postId: number) => `vitnode-blog-title-${postId}`;

const morph = (name: string): CSSProperties => ({
  viewTransitionClass: MORPH_CLASS,
  viewTransitionName: name,
});

export const blogArticleCoverTransition = (postId: number): CSSProperties =>
  morph(coverName(postId));

export const blogArticleTitleTransition = (postId: number): CSSProperties =>
  morph(titleName(postId));

export const blogCardCoverTransition = (
  postId: number,
): CSSProperties | undefined =>
  state.postId === postId ? morph(coverName(postId)) : undefined;

export const blogCardTitleTransition = (
  postId: number,
): CSSProperties | undefined =>
  state.postId === postId ? morph(titleName(postId)) : undefined;

const nameElement = (element: Element | null | undefined, name: string) => {
  if (!(element instanceof HTMLElement)) return;

  element.style.setProperty("view-transition-name", name);
  element.style.setProperty("view-transition-class", MORPH_CLASS);
};

export const rememberBlogArticle = (postId: number) => {
  state.postId = postId;
};

export const morphBlogCard = (link: HTMLElement, postId: number) => {
  state.postId = postId;
  const card = link.closest("article");
  nameElement(card?.querySelector("[data-blog-cover]"), coverName(postId));
  nameElement(card?.querySelector("[data-blog-title]"), titleName(postId));
};

const isBlogCategorySwitch = () =>
  Date.now() - state.categorySwitchAt < RECENT_MS;

export const blogCategoriesTransition = (): CSSProperties | undefined =>
  isBlogCategorySwitch() ? { viewTransitionName: CATEGORIES_NAME } : undefined;

export const switchBlogCategory = (nav: HTMLElement | null) => {
  state.categorySwitchAt = Date.now();
  nav?.style.setProperty("view-transition-name", CATEGORIES_NAME);
};

const css = `
::view-transition-group(*.${MORPH_CLASS}) {
  animation-duration: 300ms;
  animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}

::view-transition-old(*.${MORPH_CLASS}),
::view-transition-new(*.${MORPH_CLASS}) {
  height: 100%;
  animation-duration: 300ms;
}

::view-transition-group(${CATEGORIES_NAME}),
::view-transition-new(${CATEGORIES_NAME}) {
  animation: none;
}

::view-transition-old(${CATEGORIES_NAME}) {
  display: none;
}
`;

export const BlogTransitionStyles = () => (
  <style href="vitnode-blog-view-transitions" precedence="vitnode-blog">
    {css}
  </style>
);
