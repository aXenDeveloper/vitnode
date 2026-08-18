import { cacheLife } from "next/cache";

import { getLLMText, source } from "@/lib/source";

async function getLLMFullText() {
  "use cache";
  cacheLife("max");

  const scan = source.getPages().map(getLLMText);
  const scanned = await Promise.all(scan);

  return scanned.join("\n\n");
}

export async function GET() {
  return new Response(await getLLMFullText());
}
