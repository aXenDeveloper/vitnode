import "server-only";

// `redirect` from the navigation layer is the locale-aware wrapper every app-level
// redirect should use, and this is the one place it would be wrong: a delivery
// location is a **complete** path that already carries its locale segment - the
// engine built it - so routing it through the locale-aware wrapper would prefix the
// locale a second time and send `/pl/articles/x` to `/pl/pl/articles/x`. That
// wrapper is also a 307; a canonical slug change needs the permanent,
// method-preserving 308. Hence the unlocalized primitive.
import { notFound, unlocalizedPermanentRedirect } from "@/framework/navigation";

import type { DeliverableContentTypeDefinition } from "../types";
import type { ContentDeliveryResponse } from "./delivery.server";

import { contentDeliveryResolve } from "./delivery.server";

/**
 * Resolves a public URL and *acts* on the answer: renders, redirects or 404s.
 *
 * The one helper in the delivery adapter that has a side effect, and it is kept in
 * its own module because of what it imports: the navigation layer's control-flow
 * functions throw to unwind the render, so a page that only wanted metadata should
 * not be able to reach them by accident.
 *
 * ```tsx title="src/app/[locale]/articles/[slug]/page.tsx"
 * const Page = async ({ params }) => {
 *   const { locale, slug } = await params;
 *   const delivery = await contentDeliveryPage({
 *     definition: articleContentType,
 *     locale,
 *     pluginId: "@vitnode/example",
 *     slug,
 *   });
 *
 *   // Only reached when the slug is the current one - a moved URL has already
 *   // redirected and a missing one has already 404ed.
 *   return <Article delivery={delivery} />;
 * };
 * ```
 *
 * `unlocalizedPermanentRedirect` issues a **308**, which is what the engine's
 * resolver reports and the status a canonical slug change deserves: it preserves the
 * request method, where a `301` lets a client rewrite it to `GET`. Both behave
 * identically for the `GET` a content page is read with - and only one of them still
 * behaves correctly the day a form under a moved path is submitted.
 *
 * `"replace"`, so a reader who follows an old link does not have to press back twice
 * to leave the page they were never meant to land on.
 */
export const contentDeliveryPage = async ({
  definition,
  locale,
  pluginId,
  slug,
}: {
  definition: DeliverableContentTypeDefinition;
  locale?: string;
  pluginId: string;
  slug: string;
}): Promise<ContentDeliveryResponse> => {
  const resolution = await contentDeliveryResolve({
    definition,
    locale,
    pluginId,
    slug,
  });

  if (resolution.type === "redirect") {
    unlocalizedPermanentRedirect(resolution.location, "replace");
  }

  // A draft, an unpublished record, a deleted one, a slug that never existed and a
  // historical URL whose destination is no longer public are all the same 404. A
  // redirect to hidden content would be a way to confirm it exists, and that is
  // precisely what an unpublished URL must not do.
  if (resolution.type === "not_found") notFound();

  return resolution;
};
