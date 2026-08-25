import type { BaseBuildModuleReturn } from "./module";

/**
 * Swagger has exactly one grouping mechanism - the tag - so the tag has to
 * carry both halves of "where does this endpoint live": the plugin that owns
 * it and the module that serves it. `(Core) - Users` instead of the raw
 * `@vitnode/core` bucket every route used to land in.
 *
 * The *whole* module chain goes into the tag, not just the leaf, because module
 * names repeat across the tree: core has a top-level `users` module and an
 * `admin/users` one, plus `cron`, `queue` and `files` twice over. A leaf-only
 * tag would merge the public and admin halves of each into a single group.
 */

const titleCase = (value: string) =>
  value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

/** `@vitnode/core` -> `Core`, `@acme/my-plugin` -> `My Plugin`. */
export const pluginTag = (pluginId: string) =>
  titleCase(pluginId.split("/").at(-1) ?? pluginId) || pluginId;

/** `(Core) - Admin / Users` for the module chain `["admin", "users"]`. */
export const moduleTag = (pluginId: string, modules: readonly string[]) => {
  const plugin = `(${pluginTag(pluginId)})`;

  return modules.length
    ? `${plugin} - ${modules.map(titleCase).join(" / ")}`
    : plugin;
};

/**
 * Rewrites the plugin-only tag `buildRoute` put on every route into the
 * `(Plugin) - Module` one, walking the module tree so a nested module gets its
 * parents' names too. Returns the tags it assigned, in declaration order, for
 * the document's own `tags` list.
 *
 * <Callout type="warn">
 * The tag array is edited **in place**. `OpenAPIHono#route` shallow-copies each
 * registered route when a module is mounted, so by the time a plugin is built
 * the same route already sits in one registry per level of nesting - all of them
 * sharing this one array. Replacing `route.tags` would only retag the deepest
 * copy, and the mounted parents would keep serving the old tag.
 * </Callout>
 */
export const applyModuleTags = (
  module: BaseBuildModuleReturn,
  pluginId: string,
  parents: readonly string[] = [],
): string[] => {
  const chain = [...parents, module.name];
  const tag = moduleTag(pluginId, chain);
  const previous = pluginTag(pluginId);
  let assigned = false;

  module.routes.forEach(({ route }) => {
    const tags = route.tags;
    assigned = true;

    if (!tags) {
      route.tags = [tag];

      return;
    }

    const index = tags.indexOf(previous);

    if (index !== -1) {
      tags[index] = tag;
    } else if (!tags.includes(tag)) {
      tags.unshift(tag);
    }
  });

  return [
    ...(assigned ? [tag] : []),
    ...(module.modules ?? []).flatMap(child =>
      applyModuleTags(child, pluginId, chain),
    ),
  ];
};
