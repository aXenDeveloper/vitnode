import { fetcher } from "@vitnode/core/tanstack/fetcher";

import { manifest } from "@/manifest.gen";

export const fetchBoards = async () => {
  const res = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "content/boards",
    path: "/",
    args: { query: {} },
  });

  if (res.status !== 200) throw new Error("Loading the boards failed.");

  const { items } = await res.json();

  return items;
};

export type Board = Awaited<ReturnType<typeof fetchBoards>>[number];

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export const boardColor = (board: Pick<Board, "metadata">): null | string =>
  typeof board.metadata.color === "string" &&
  HEX_COLOR.test(board.metadata.color)
    ? board.metadata.color
    : null;
