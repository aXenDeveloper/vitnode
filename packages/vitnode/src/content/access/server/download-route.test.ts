import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  accessTopics,
  createAccessWorld,
  FILE,
  TOPIC,
  USER,
} from "@/tests/content-access";

import { CONTENT_ACCESS_REQUIRED_CODE } from "../const";

const download = (fileId: number) =>
  `/topic-files/${TOPIC.READERS}/files/${fileId}`;

describe("GET /{id}/files/{fileId}", () => {
  // The topic is in a board members read and only VIP downloads from.
  it.each([
    ["a guest, who cannot read the topic", undefined, FILE.PDF, 404],
    ["a reader without the download rule", USER.MEMBER, FILE.PDF, 403],
    ["a reader with it", USER.VIP, FILE.PDF, 200],
    ["a file the topic does not hold", USER.VIP, FILE.ELSEWHERE, 404],
  ])("answers %s with %i", async (_label, user, fileId, status) => {
    const world = await createAccessWorld();

    const response = await world.send("GET", download(fileId), { user });

    expect(response.status).toBe(status);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("says only that access is required, and never opens the file", async () => {
    const world = await createAccessWorld();

    const response = await world.send("GET", download(FILE.PDF), {
      user: USER.MEMBER,
    });

    await expect(response.json()).resolves.toEqual({
      accessRequired: true,
      code: CONTENT_ACCESS_REQUIRED_CODE,
    });
    expect(world.opened).toEqual([]);
  });

  it("serves an image to every reader, download rule or not", async () => {
    const world = await createAccessWorld();
    await world.memory.db
      .update(accessTopics.table)
      .set({ attachment: FILE.IMAGE })
      .where(eq(accessTopics.table.id, TOPIC.READERS));

    const response = await world.send("GET", download(FILE.IMAGE), {
      user: USER.MEMBER,
    });

    expect(response.status).toBe(200);
    expect(world.opened).toEqual(["b.png"]);
  });
});
