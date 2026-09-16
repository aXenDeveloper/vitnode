import type { ReactElement } from "react";

import { createElement, Fragment } from "react";

import type {
  AnyBlockInstance,
  BlockAllowedSpec,
  BlockRegistry,
  BlockRenderFallback,
  BlockRenderFallbackProps,
  BlockValidationMode,
} from "./types";

import { isBlockInstance } from "./instance";
import { isBlockAllowed, resolveBlockRegistry } from "./registry";
import { blockDataShapeIssue } from "./shape";

const isDevelopment = (): boolean => process.env.NODE_ENV !== "production";

const shouldValidate = (mode: BlockValidationMode): boolean =>
  mode === "always" || (mode === "development" && isDevelopment());

const warn = (seen: null | Set<string>, key: string, message: string): void => {
  if (!seen || seen.has(key)) return;

  seen.add(key);
  // eslint-disable-next-line no-console
  console.warn(`\x1b[34m[VitNode]\x1b[0m \x1b[33m${message}\x1b[0m`);
};

const HEADLINES: Record<
  BlockRenderFallbackProps["reason"],
  (instance: AnyBlockInstance) => string
> = {
  "invalid-data": instance =>
    `Block "${instance.type}" has data that does not match its fields.`,
  "not-allowed": instance =>
    `Block "${instance.type}" is not allowed in this zone.`,
  "unknown-type": instance => `Block "${instance.type}" is not registered.`,
};

const DevNotice = ({ instance, reason }: BlockRenderFallbackProps) => {
  if (!isDevelopment()) return null;

  return (
    <div
      className="border-destructive/60 bg-destructive/5 text-destructive rounded-md border border-dashed p-4 text-sm leading-relaxed"
      data-block-id={instance.id}
      data-block-type={instance.type}
      role="note"
    >
      <p className="font-medium text-pretty">{HEADLINES[reason](instance)}</p>
      <p className="mt-1 text-pretty">
        {reason === "unknown-type"
          ? "Install or enable the plugin that provides it, or remove the block. This notice is shown in development only - visitors see nothing."
          : "The block was skipped. This notice is shown in development only - visitors see nothing."}
      </p>
    </div>
  );
};

interface RenderInstanceArgs {
  allowed: BlockAllowedSpec | undefined;
  fallback: BlockRenderFallback;
  index: number;
  instance: AnyBlockInstance;
  registry: BlockRegistry;
  seen: null | Set<string>;
  validate: boolean;
}

const renderInstance = ({
  allowed,
  fallback,
  index,
  instance,
  registry,
  seen,
  validate,
}: RenderInstanceArgs): null | ReactElement => {
  if (
    validate &&
    allowed !== undefined &&
    !isBlockAllowed(allowed, instance.type)
  ) {
    warn(
      seen,
      `not-allowed:${instance.type}`,
      `Block "${instance.type}" is stored here but the zone it is rendered in does not allow it. It is skipped.`,
    );

    return fallback({ instance, reason: "not-allowed" });
  }

  const entry = registry.get(instance.type);

  if (!entry) {
    warn(
      seen,
      `unknown:${instance.type}`,
      `Block "${instance.type}" is stored in content but no plugin registers it. It is skipped.`,
    );

    return fallback({ instance, reason: "unknown-type" });
  }

  const issue = validate
    ? blockDataShapeIssue(entry.definition, instance.data)
    : null;

  if (issue !== null) {
    warn(
      seen,
      `invalid:${instance.type}`,
      `Block "${instance.type}" is stored with data that does not match its fields - ${issue}. It is skipped.`,
    );

    return fallback({ instance, reason: "invalid-data" });
  }

  return createElement(entry.definition.component, {
    blockId: instance.id,
    data: instance.data,
    index,
    type: instance.type,
  });
};

export interface ContentRendererProps {
  allowed?: BlockAllowedSpec;
  blocks: null | readonly unknown[] | undefined;
  fallback?: BlockRenderFallback;
  registry?: BlockRegistry;
  validate?: BlockValidationMode;
}

export const ContentRenderer = ({
  allowed,
  blocks,
  fallback = ({ instance, reason }) =>
    createElement(DevNotice, { instance, reason }),
  registry,
  validate = "development",
}: ContentRendererProps) => {
  if (!blocks || blocks.length === 0) return null;

  const resolved = resolveBlockRegistry(registry);
  const validating = shouldValidate(validate);
  const seen = isDevelopment() ? new Set<string>() : null;

  return (
    <>
      {blocks.map((block, index) => {
        if (!isBlockInstance(block)) {
          warn(
            seen,
            `shape:${String(index)}`,
            "A value in a blocks field is not a block instance. It is skipped.",
          );

          return null;
        }

        return createElement(
          Fragment,
          { key: block.id },
          renderInstance({
            allowed,
            fallback,
            index,
            instance: block,
            registry: resolved,
            seen,
            validate: validating,
          }),
        );
      })}
    </>
  );
};
