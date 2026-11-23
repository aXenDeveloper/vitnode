import { createFileRoute } from "@tanstack/react-router";
import { sitemapIndexHandler } from "@vitnode/core/tanstack/seo/server";

export const Route = createFileRoute("/sitemap.xml")({
  server: { handlers: { GET: sitemapIndexHandler } },
});
