import type { Context } from "hono";

import type { AnyContentModel } from "../../server/model";
import type { ContentAccessFamily } from "./families";

import { invalidatePageCacheTags } from "../../../page-cache/store.server";
import {
  contentAccessTag,
  contentContainerTag,
  contentDeliverySitemapTag,
  contentPublicListTag,
} from "../../cache";
import {
  bumpContentContainerGeneration,
  bumpContentPublicGeneration,
} from "../../server/public-cache";
import { forgetContentAccessActor } from "./actor";
import {
  forgetContentAccessAllowed,
  forgetContentAccessFamilyStates,
} from "./families";
import { forgetContentAccessRules } from "./rules";
import { contentAccessFamilyOf } from "./source";

/** Content models whose records live in `family`, directly or through a parent. */
export const contentModelsInAccessFamily = (
  c: Context,
  familyId: string,
): AnyContentModel[] =>
  ((c.get("core")?.contentModels ?? []) as { model: AnyContentModel }[])
    .map(entry => entry.model)
    .filter(model => contentAccessFamilyOf(c, model)?.id === familyId);

/** Drops this request's memoised access state after it changed some of it. */
export const forgetContentAccessState = (c: Context): void => {
  forgetContentAccessActor(c);
  forgetContentAccessRules(c);
  forgetContentAccessFamilyStates(c);
  forgetContentAccessAllowed(c);
};

/**
 * Expires everything a family's rules or tree decide, after the change
 * committed: shared page-cache entries (hard, so a now-private page is never
 * served again), the cached public reads of every content type filed in it,
 * its container tree, and its sitemaps. Search needs nothing: results are
 * checked against the current rules on every query.
 */
export const expireContentAccessFamily = async (
  c: Context,
  family: Pick<ContentAccessFamily, "id" | "kind">,
): Promise<void> => {
  forgetContentAccessState(c);
  const models = contentModelsInAccessFamily(c, family.id);

  await Promise.all([
    invalidatePageCacheTags(
      [
        contentAccessTag(family.id),
        ...(family.kind === "container"
          ? [contentContainerTag(family.id)]
          : [contentPublicListTag(family.id)]),
        ...models.flatMap(model => [
          contentPublicListTag(model.definition.id),
          contentDeliverySitemapTag(model.definition.id),
        ]),
      ],
      { mode: "hard" },
    ).catch(() => undefined),
    family.kind === "container"
      ? bumpContentContainerGeneration(c, family.id)
      : bumpContentPublicGeneration(c, family.id).catch(() => undefined),
    ...models.map(async model => {
      await bumpContentPublicGeneration(c, model.definition.id).catch(
        () => undefined,
      );
    }),
  ]);
};
