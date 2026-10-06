import type { z } from "zod";

import type {
  AiActionDefaults,
  AiActionOutputMode,
  AiActorType,
  AnyAiActionDefinition,
} from "./action";
import type { AiModelCapability } from "./capabilities";

import { AiActionDefinitionError } from "./action";

/** `<pluginId>:<localId>`, e.g. `@vitnode/blog:excerpt.generate`. */
export type AiActionKey = `${string}:${string}`;

export interface RegisteredAiAction {
  definition: AnyAiActionDefinition;
  /** Canonical identity. */
  key: AiActionKey;
  /** Canonical permission identity, `<pluginId>:<permission key>`. */
  permissionKey: string;
  pluginId: string;
}

/**
 * The serializable half of an action - what the AdminCP and the editor may
 * see. Prompt builders, schemas and models never leave the server.
 */
export interface AiActionPublicMetadata {
  actors: AiActorType[];
  defaults: AiActionDefaults;
  description: string;
  /** A Lucide icon name, or `null` for the default AI icon. */
  icon: null | string;
  key: AiActionKey;
  localId: string;
  output: AiActionOutputMode;
  permission: { defaultGranted: boolean; key: string };
  pluginId: string;
  promptVersion: number;
  requiredCapabilities: AiModelCapability[];
  title: string;
}

export const aiActionKey = (pluginId: string, localId: string): AiActionKey =>
  `${pluginId}:${localId}`;

/**
 * A canonical action key that remembers its action's input and output types,
 * so `c.get("ai").run({ action, input })` infers both.
 */
export type TypedAiActionKey<Input, Output> = AiActionKey & {
  readonly __aiAction?: { input: Input; output: Output };
};

export const aiActionRef = <Definition extends AnyAiActionDefinition>(
  pluginId: string,
  definition: Definition,
): TypedAiActionKey<
  z.input<Definition["inputSchema"]>,
  z.output<Definition["outputSchema"]>
> => aiActionKey(pluginId, definition.id);

/** Splits on the *last* colon: plugin ids are npm names and may contain `:` only in theory. */
export const parseAiActionKey = (
  key: string,
): null | { localId: string; pluginId: string } => {
  const index = key.lastIndexOf(":");
  if (index <= 0 || index === key.length - 1) return null;

  return { pluginId: key.slice(0, index), localId: key.slice(index + 1) };
};

export class UnknownAiActionError extends Error {
  constructor(key: string) {
    super(`AI action "${key}" is not registered by any installed plugin.`);
    this.name = "UnknownAiActionError";
  }
}

export class AiActionRegistry {
  constructor(actions: RegisteredAiAction[]) {
    this.actions = new Map(actions.map(action => [action.key, action]));
  }

  private readonly actions: Map<string, RegisteredAiAction>;

  all(): RegisteredAiAction[] {
    return [...this.actions.values()];
  }

  find(key: string): RegisteredAiAction | undefined {
    return this.actions.get(key);
  }

  get(key: string): RegisteredAiAction {
    const action = this.actions.get(key);
    if (!action) throw new UnknownAiActionError(key);

    return action;
  }

  has(key: string): boolean {
    return this.actions.has(key);
  }

  publicMetadata(): AiActionPublicMetadata[] {
    return this.all().map(projectAiAction);
  }
}

export const projectAiAction = ({
  definition,
  key,
  permissionKey,
  pluginId,
}: RegisteredAiAction): AiActionPublicMetadata => ({
  actors: [...definition.actors],
  defaults: { ...definition.defaults },
  description: definition.description,
  icon: definition.icon ?? null,
  key,
  localId: definition.id,
  output: definition.output,
  permission: {
    defaultGranted: definition.permission.defaultGranted,
    key: permissionKey,
  },
  pluginId,
  promptVersion: definition.promptVersion,
  requiredCapabilities: [...definition.requiredCapabilities],
  title: definition.title,
});

/**
 * Registers every plugin's actions under their canonical identity. The same
 * local id may appear in two plugins; the same canonical identity may not.
 */
export const collectAiActions = (
  plugins: { aiActions?: AnyAiActionDefinition[]; pluginId: string }[],
): AiActionRegistry => {
  const registered: RegisteredAiAction[] = [];
  const seen = new Set<string>();
  // A permission key names one descriptor: two actions sharing a key must
  // agree on its default, or which one wins would depend on plugin order.
  const permissionDefaults = new Map<string, boolean>();

  for (const plugin of plugins) {
    for (const definition of plugin.aiActions ?? []) {
      const key = aiActionKey(plugin.pluginId, definition.id);
      if (seen.has(key)) {
        throw new AiActionDefinitionError(
          `AI action "${key}" is registered twice. Each plugin's action ids must be unique.`,
        );
      }
      seen.add(key);

      const permissionKey = `${plugin.pluginId}:${definition.permission.key}`;
      const known = permissionDefaults.get(permissionKey);
      if (
        known !== undefined &&
        known !== definition.permission.defaultGranted
      ) {
        throw new AiActionDefinitionError(
          `AI permission "${permissionKey}" is declared with different defaultGranted values.`,
        );
      }
      permissionDefaults.set(
        permissionKey,
        definition.permission.defaultGranted,
      );

      registered.push({
        definition,
        key,
        permissionKey,
        pluginId: plugin.pluginId,
      });
    }
  }

  return new AiActionRegistry(registered);
};

/**
 * Every content field that asks for AI assistance names an action that
 * exists and can run for users. Checked at boot, when both registries are
 * complete - a typo fails the start, not the first editor who clicks.
 */
export const assertContentAiActions = (
  contentTypes: {
    definition: {
      fields: Record<string, { ai?: { action: string }; kind: string }>;
      id: string;
    };
  }[],
  registry: AiActionRegistry,
): void => {
  for (const { definition } of contentTypes) {
    for (const [name, field] of Object.entries(definition.fields)) {
      if (!field.ai) continue;
      const action = registry.find(field.ai.action);
      if (!action) {
        throw new AiActionDefinitionError(
          `Content type "${definition.id}" field "${name}" uses AI action "${field.ai.action}", which no installed plugin registers.`,
        );
      }
      if (!action.definition.actors.includes("user")) {
        throw new AiActionDefinitionError(
          `Content type "${definition.id}" field "${name}" uses AI action "${field.ai.action}", which only the system may run.`,
        );
      }
    }
  }
};
