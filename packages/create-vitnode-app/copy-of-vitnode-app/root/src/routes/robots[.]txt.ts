import { createFileRoute } from "@tanstack/react-router";
import { robotsTxtHandler } from "@vitnode/core/tanstack/seo/server";

export const Route = createFileRoute("/robots.txt")({
  server: { handlers: { GET: robotsTxtHandler } },
});
