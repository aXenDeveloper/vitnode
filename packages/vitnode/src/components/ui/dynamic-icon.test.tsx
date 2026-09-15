// @vitest-environment node
import React from "react";
import { renderToReadableStream } from "react-dom/server";
import { expect, test } from "vitest";

import { DynamicIcon } from "./dynamic-icon";

const renderToHtml = async (node: React.ReactElement) => {
  const stream = await renderToReadableStream(node);
  await stream.allReady;

  return new Response(stream).text();
};

test("renders the icon into the server-rendered shell", async () => {
  const html = await renderToHtml(
    <DynamicIcon
      className="size-4"
      fallback={<span id="fallback" />}
      name="house"
    />,
  );

  expect(html).toContain("lucide-house");
  expect(html).toContain("size-4");
  expect(html).not.toContain('id="fallback"');
});

test("renders nothing for an unknown icon", async () => {
  const html = await renderToHtml(<DynamicIcon name="not-a-real-icon" />);

  expect(html).not.toContain("<svg");
});
