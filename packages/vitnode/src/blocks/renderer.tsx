import type { ReactElement } from "react";

import { createElement, Fragment } from "react";

import type {
  AnyBlockInstance,
  BlockRegistry,
  BlockRenderFallback,
  BlockRenderFallbackProps,
} from "./types";

import { isBlockInstance } from "./instance";
import { blockRegistry } from "./registry";

const warned = new Set<string>();

const isDevelopment = (): boolean => process.env.NODE_ENV !== "production";

const warnOnce = (key: string, message: string): void => {
  if (!isDevelopment() || warned.has(key)) return;

  warned.add(key);
  // eslint-disable-next-line no-console
  console.warn(`\x1b[34m[VitNode]\x1b[0m \x1b[33m${message}\x1b[0m`);
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
      <p className="font-medium text-pretty">
        {reason === "unknown-type"
          ? `Block "${instance.type}" is not registered.`
          : `Block "${instance.type}" has data that does not match its fields.`}
      </p>
      <p className="mt-1 text-pretty">
        {reason === "unknown-type"
          ? "Install or enable the plugin that provides it, or remove the block. This notice is shown in development only - visitors see nothing."
          : "The block was skipped. This notice is shown in development only - visitors see nothing."}
      </p>
    </div>
  );
};

const renderInstance = (
  instance: AnyBlockInstance,
  index: number,
  registry: BlockRegistry,
  fallback: BlockRenderFallback,
): null | ReactElement => {
  const entry = registry.get(instance.type);

  if (!entry) {
    warnOnce(
      `unknown:${instance.type}`,
      `Block "${instance.type}" is stored in content but no plugin registers it. It is skipped.`,
    );

    return fallback({ instance, reason: "unknown-type" });
  }

  let data;
  try {
    data = entry.definition.parse(instance.data);
  } catch {
    warnOnce(
      `invalid:${instance.type}`,
      `Block "${instance.type}" is stored with data that does not match its fields. It is skipped.`,
    );

    return fallback({ instance, reason: "invalid-data" });
  }

  return createElement(entry.definition.component, {
    blockId: instance.id,
    data,
    index,
    type: instance.type,
  });
};

export interface ContentRendererProps {
  blocks: null | readonly unknown[] | undefined;
  fallback?: BlockRenderFallback;
  registry?: BlockRegistry;
}

export const ContentRenderer = ({
  blocks,
  fallback = ({ instance, reason }) =>
    createElement(DevNotice, { instance, reason }),
  registry,
}: ContentRendererProps) => {
  if (!blocks || blocks.length === 0) return null;

  const resolved = registry ?? blockRegistry();

  return (
    <>
      {blocks.map((block, index) => {
        if (!isBlockInstance(block)) {
          warnOnce(
            `shape:${String(index)}`,
            "A value in a blocks field is not a block instance. It is skipped.",
          );

          return null;
        }

        return createElement(
          Fragment,
          { key: block.id },
          renderInstance(block, index, resolved, fallback),
        );
      })}
    </>
  );
};
