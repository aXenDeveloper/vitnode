import { fetcher } from "@vitnode/core/tanstack/fetcher";

import { manifest } from "@/manifest.gen";

export const fetchDesks = async () => {
  const res = await fetcher({
    plugin: manifest.id,
    method: "get",
    module: "content/desks",
    path: "/",
    args: { query: {} },
  });

  if (res.status !== 200) throw new Error("Loading the desks failed.");

  const { items } = await res.json();

  return items;
};

export type Desk = Awaited<ReturnType<typeof fetchDesks>>[number];

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export const deskColor = (desk: Pick<Desk, "metadata">): null | string =>
  typeof desk.metadata.color === "string" && HEX_COLOR.test(desk.metadata.color)
    ? desk.metadata.color
    : null;
