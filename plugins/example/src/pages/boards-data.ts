import { fetcher } from "@vitnode/core/tanstack/fetcher";

import { CONFIG_PLUGIN } from "@/const";

/** Every board, each parent followed by its subtree - nest it with `contentContainerTree`. */
export const fetchBoards = async () => {
  const res = await fetcher({
    plugin: CONFIG_PLUGIN.pluginId,
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

/** The board's color, only when it is a hex value safe to put in a style. */
export const boardColor = (board: Pick<Board, "metadata">): null | string =>
  typeof board.metadata.color === "string" &&
  HEX_COLOR.test(board.metadata.color)
    ? board.metadata.color
    : null;
