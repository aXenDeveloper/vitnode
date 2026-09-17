import type { ReactElement } from "react";

import { createElement, Fragment } from "react";

import type { BlockAreaInstance } from "./types";

import { areaLayoutClassNames, contentNodeKey } from "./area";

export type ContentAreaChildRenderer = (
  child: unknown,
  index: number,
) => null | ReactElement;

export interface ContentAreaProps {
  area: BlockAreaInstance;
  renderChild: ContentAreaChildRenderer;
}

export const ContentArea = ({
  area,
  renderChild,
}: ContentAreaProps): null | ReactElement => {
  if (area.children.length === 0) return null;

  return createElement(
    "div",
    {
      className: areaLayoutClassNames(area.layout),
      "data-area-id": area.id,
    },
    area.children.map((child, index) =>
      createElement(
        Fragment,
        { key: contentNodeKey(child, index) },
        renderChild(child, index),
      ),
    ),
  );
};
