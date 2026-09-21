// @vitest-environment node
import React from "react";
import { renderToReadableStream } from "react-dom/server";
import { beforeAll, expect, test } from "vitest";

import { DynamicIcon } from "./dynamic-icon";
import {
  createLucideIconCollector,
  loadLucideIcon,
  LucideIconCollectorContext,
} from "./icon-registry";

const renderToHtml = async (node: React.ReactElement) => {
  const stream = await renderToReadableStream(node);
  await stream.allReady;

  return new Response(stream).text();
};

beforeAll(async () => {
  await Promise.all([
    loadLucideIcon("house"),
    loadLucideIcon("not-a-real-icon"),
  ]);
});

test("renders the icon into the server-rendered shell without Suspense", async () => {
  const html = await renderToHtml(
    <LucideIconCollectorContext.Provider value={createLucideIconCollector()}>
      <DynamicIcon
        className="size-4"
        fallback={<span id="fallback" />}
        name="house"
      />
    </LucideIconCollectorContext.Provider>,
  );

  expect(html).toContain("lucide-house");
  expect(html).toContain("size-4");
  expect(html).not.toContain('id="fallback"');
  expect(html).not.toContain("<!--$");
});

test("hands every rendered icon to the collector", async () => {
  const collector = createLucideIconCollector();

  await renderToHtml(
    <LucideIconCollectorContext.Provider value={collector}>
      <DynamicIcon name="house" />
      <DynamicIcon name="not-a-real-icon" />
    </LucideIconCollectorContext.Provider>,
  );

  const snapshot = collector.snapshot();

  expect(snapshot.house?.name).toBe("house");
  expect(snapshot.house?.node.length).toBeGreaterThan(0);
  expect(snapshot["not-a-real-icon"]).toBeNull();
});

test("renders the fallback when no collector can carry the icon to the client", async () => {
  const html = await renderToHtml(
    <DynamicIcon fallback={<span id="fallback" />} name="house" />,
  );

  expect(html).toContain('id="fallback"');
  expect(html).not.toContain("<svg");
});

test("renders nothing for an unknown icon", async () => {
  const html = await renderToHtml(
    <LucideIconCollectorContext.Provider value={createLucideIconCollector()}>
      <DynamicIcon name="not-a-real-icon" />
    </LucideIconCollectorContext.Provider>,
  );

  expect(html).toBe("");
});
