export type TopLevelOnlyRegistration =
  | "cronJobs"
  | "events"
  | "queueTasks"
  | "webSockets";

export interface ModuleRegistrationTree {
  cronJobs?: readonly unknown[];
  events?: readonly unknown[];
  modules?: readonly ModuleRegistrationTree[];
  name: string;
  queueTasks?: readonly unknown[];
  webSockets?: readonly unknown[];
}

export interface NestedRegistration {
  kind: TopLevelOnlyRegistration;
  modulePath: string;
  names: string[];
}

const KINDS: readonly TopLevelOnlyRegistration[] = [
  "cronJobs",
  "events",
  "queueTasks",
  "webSockets",
];

const nameOf = (entry: unknown): string => {
  if (typeof entry !== "object" || entry === null) return "?";
  const { event, id, name } = entry as {
    event?: unknown;
    id?: unknown;
    name?: unknown;
  };
  const value = name ?? id ?? event;

  return typeof value === "string" ? value : "?";
};

export const findNestedRegistrations = (
  modules: readonly ModuleRegistrationTree[],
): NestedRegistration[] => {
  const found: NestedRegistration[] = [];

  const visit = (
    module: ModuleRegistrationTree,
    path: string,
    nested: boolean,
  ) => {
    if (nested) {
      for (const kind of KINDS) {
        const entries = module[kind];
        if (entries !== undefined && entries.length > 0) {
          found.push({
            kind,
            modulePath: path,
            names: entries.map(nameOf),
          });
        }
      }
    }

    for (const child of module.modules ?? []) {
      visit(child, `${path}/${child.name}`, true);
    }
  };

  for (const module of modules) visit(module, module.name, false);

  return found;
};

/**
 * One line saying what a nested registration is, that it never runs and how to
 * fix it. With `pluginId`, the line also names the plugin, for logs that
 * mix plugins.
 */
export const describeNestedRegistration = (
  { kind, modulePath, names }: NestedRegistration,
  pluginId?: string,
): string => {
  const topLevel = modulePath.split("/")[0] ?? modulePath;
  const declared = names.map(name => `"${name}"`).join(", ");

  return `${pluginId === undefined ? "" : `${pluginId}: `}${kind} ${declared} on nested module "${modulePath}" never run - buildApiPlugin collects ${kind} from top-level modules only. Move ${names.length === 1 ? "it" : "them"} to buildModule({ ${kind} }) of the top-level module "${topLevel}".`;
};
