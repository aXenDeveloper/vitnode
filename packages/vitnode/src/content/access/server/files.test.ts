import { describe, expect, it } from "vitest";

import {
  ARTICLE,
  createAccessWorld,
  FILE,
  testAccessArticleContentType,
  USER,
} from "@/tests/content-access";

import { protectContentPublicRowFiles } from "./files";

const route = (fileId: number) =>
  expect.stringMatching(
    new RegExp(
      `/api/@vitnode/example/content/access-articles/${ARTICLE}/files/${fileId}$`,
    ),
  );

const row = () => ({
  attachment: {
    id: FILE.PDF,
    mimeType: "application/pdf",
    name: "a.pdf",
    size: 3,
    url: "https://storage.example/a.pdf",
  },
  body: {
    content: [
      {
        attrs: { fileId: FILE.PDF, name: "a.pdf", size: 3, src: "a.pdf" },
        type: "attachment",
      },
      { attrs: { fileId: FILE.IMAGE, src: "b.png" }, type: "image" },
    ],
    type: "doc",
  },
  id: ARTICLE,
});

const protect = async (userId: number) => {
  const world = await createAccessWorld();
  const [protectedRow] = await protectContentPublicRowFiles(
    world.contextFor(userId),
    testAccessArticleContentType,
    [row()],
  );

  return protectedRow as ReturnType<typeof row>;
};

describe("protectContentPublicRowFiles", () => {
  it("strips the attachments a reader may not download, in fields and rich text", async () => {
    const { attachment, body } = await protect(USER.MEMBER);

    expect(attachment).toEqual({
      id: FILE.PDF,
      mimeType: null,
      name: "",
      restricted: true,
      size: 0,
      url: "",
    });
    expect(body.content[0]).toEqual({
      attrs: {
        fileId: null,
        mimeType: null,
        name: null,
        restricted: true,
        size: null,
        src: null,
      },
      type: "attachment",
    });
  });

  it("shows images to every reader, through the authorized route", async () => {
    const { body } = await protect(USER.MEMBER);

    expect(body.content[1]).toEqual({
      attrs: { fileId: FILE.IMAGE, src: route(FILE.IMAGE) },
      type: "image",
    });
  });

  it("points a reader who may download at the authorized route", async () => {
    const { attachment, body } = await protect(USER.VIP);

    expect(attachment).toMatchObject({ name: "a.pdf", url: route(FILE.PDF) });
    expect(body.content[0].attrs).toMatchObject({
      name: "a.pdf",
      src: route(FILE.PDF),
    });
  });
});
