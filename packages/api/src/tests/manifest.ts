import type { PluginManifest } from "@/lib/plugin-manifest";

export const testManifest = <const Id extends string>(
  id: Id,
  overrides: Partial<Omit<PluginManifest<Id>, "id">> = {},
): PluginManifest<Id> => ({
  author: null,
  description: null,
  icon: null,
  id,
  license: null,
  title: id,
  version: null,
  ...overrides,
});
