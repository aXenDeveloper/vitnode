import type { VitNodeConfig } from "../../vitnode.config";
import type {
  ContentFrontendRegistry,
  RegisteredFrontendContentType,
} from "./registry";

import { getVitNodeConfig } from "../../vitnode.config";
import { buildContentFrontendRegistry } from "./registry";

/**
 * The Content Engine registry, as a Next.js application reads it.
 *
 * A thin adapter rather than a registry of its own: everything about what a
 * registration *is* lives in `./registry.ts`, and this supplies the one thing
 * that differs between the two hosts - where the plugin list comes from. In
 * Next.js `vitnode.config.ts` is only ever touched by Server Components, so the
 * whole plugin registry, editing screens included, can be walked in the render
 * pass. A TanStack Start application has no such boundary and builds the same
 * registry from a generated module instead; see
 * `setContentFrontendRegistry`.
 *
 * Reads the app config rather than a mutable singleton, so hot reload simply
 * re-derives it.
 */

export type { ContentFrontendRegistry, RegisteredFrontendContentType };

/**
 * One registry per config object.
 *
 * Keyed on the config itself rather than cached in a variable, which is what
 * keeps hot reload working: `buildConfig` registers a *new* object, so a
 * changed config is a cache miss by construction and there is nothing to
 * invalidate. A `WeakMap` also means a discarded config takes its registry with
 * it.
 *
 * Worth doing at all because the alternative is what this replaced: every
 * lookup re-ran `validateContentTypes` over every content type's fields and
 * indexes, and a single content screen resolves a content type for its
 * metadata, its breadcrumb, its permission checks and its table.
 */
const registries = new WeakMap<VitNodeConfig, ContentFrontendRegistry>();

const registryFor = (vitNodeConfig: VitNodeConfig): ContentFrontendRegistry => {
  const existing = registries.get(vitNodeConfig);
  if (existing) return existing;

  const registry = buildContentFrontendRegistry(vitNodeConfig.plugins);
  registries.set(vitNodeConfig, registry);

  return registry;
};

/** Every content type registered with the AdminCP, in a deterministic order. */
export const getFrontendContentTypes = (
  vitNodeConfig: VitNodeConfig = getVitNodeConfig(),
): RegisteredFrontendContentType[] => [...registryFor(vitNodeConfig).all()];

export const findFrontendContentType = (
  contentTypeId: string,
  vitNodeConfig: VitNodeConfig = getVitNodeConfig(),
): RegisteredFrontendContentType | undefined =>
  registryFor(vitNodeConfig).byId(contentTypeId);

export const findFrontendContentTypeByAdminPath = (
  adminPath: string,
  vitNodeConfig: VitNodeConfig = getVitNodeConfig(),
): RegisteredFrontendContentType | undefined =>
  registryFor(vitNodeConfig).byAdminPath(adminPath);
