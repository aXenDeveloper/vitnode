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

import {
  areaLikeId,
  contentNodeKey,
  isAreaLike,
  isBlockAreaInstance,
} from "./area";
import { ContentArea } from "./area-renderer";
import { isBlockInstance } from "./instance";
import { isBlockAllowed, resolveBlockRegistry } from "./registry";
import { blockDataShapeIssue } from "./shape";
import { resolveBlockVariant } from "./variant";

const isDevelopment = (): boolean => process.env.NODE_ENV !== "production";

const shouldDiagnose = (mode: BlockValidationMode): boolean =>
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
  "unknown-variant": instance =>
    `Block "${instance.type}" is stored with a variant it does not define.`,
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

type ContentAreaIssue = "malformed-area" | "nested-area";

const AREA_HEADLINES: Record<ContentAreaIssue, string> = {
  "malformed-area":
    "An area stored here has a layout or a child list this version cannot read.",
  "nested-area": "An area is stored inside another area.",
};

const AREA_DETAILS: Record<ContentAreaIssue, string> = {
  "malformed-area":
    "It was skipped and nothing was removed from what is stored. This notice is shown in development only - visitors see nothing.",
  "nested-area":
    "An area cannot hold another area, so it was skipped. Nothing was removed from what is stored. This notice is shown in development only - visitors see nothing.",
};

interface AreaDevNoticeProps {
  areaId: string | undefined;
  reason: ContentAreaIssue;
}

const AreaDevNotice = ({ areaId, reason }: AreaDevNoticeProps) => {
  if (!isDevelopment()) return null;

  return (
    <div
      className="border-destructive/60 bg-destructive/5 text-destructive rounded-md border border-dashed p-4 text-sm leading-relaxed"
      data-area-id={areaId}
      role="note"
    >
      <p className="font-medium text-pretty">{AREA_HEADLINES[reason]}</p>
      <p className="mt-1 text-pretty">{AREA_DETAILS[reason]}</p>
    </div>
  );
};

interface RenderContext {
  allowed: BlockAllowedSpec | undefined;
  diagnose: boolean;
  fallback: BlockRenderFallback;
  registry: BlockRegistry;
  seen: null | Set<string>;
}

interface RenderInstanceArgs extends RenderContext {
  index: number;
  instance: AnyBlockInstance;
}

interface RenderNodeArgs extends RenderContext {
  index: number;
  nested: boolean;
  node: unknown;
}

const renderInstance = ({
  allowed,
  diagnose,
  fallback,
  index,
  instance,
  registry,
  seen,
}: RenderInstanceArgs): null | ReactElement => {
  if (
    diagnose &&
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

  const issue = blockDataShapeIssue(entry.definition, instance.data);

  if (issue !== null) {
    if (diagnose) {
      warn(
        seen,
        `invalid:${instance.type}`,
        `Block "${instance.type}" is stored with data that does not match its fields - ${issue}. It is skipped.`,
      );
    }

    return fallback({ instance, reason: "invalid-data" });
  }

  const resolution = resolveBlockVariant(entry.definition, instance.variant);

  if (resolution.kind === "unknown") {
    warn(
      seen,
      `unknown-variant:${instance.type}:${resolution.variant}`,
      `Block "${instance.type}" is stored with the variant "${resolution.variant}", which it does not define. It is skipped so the page never renders a presentation nobody chose.`,
    );

    return fallback({ instance, reason: "unknown-variant" });
  }

  return createElement(entry.definition.component, {
    blockId: instance.id,
    data: instance.data,
    index,
    type: instance.type,
    variant: resolution.variant,
  });
};

const renderNode = ({
  index,
  nested,
  node,
  ...context
}: RenderNodeArgs): null | ReactElement => {
  if (isAreaLike(node)) {
    const areaId = areaLikeId(node);

    if (nested) {
      warn(
        context.seen,
        `nested-area:${areaId ?? String(index)}`,
        "An area is stored inside another area. Areas cannot hold areas, so it is skipped.",
      );

      return createElement(AreaDevNotice, { areaId, reason: "nested-area" });
    }

    if (!isBlockAreaInstance(node)) {
      warn(
        context.seen,
        `malformed-area:${areaId ?? String(index)}`,
        "A value stored in a blocks field says it is an area but its layout or its children cannot be read. It is skipped and nothing stored is removed.",
      );

      return createElement(AreaDevNotice, { areaId, reason: "malformed-area" });
    }

    return createElement(ContentArea, {
      area: node,
      renderChild: (child, at) =>
        renderNode({ ...context, index: at, nested: true, node: child }),
    });
  }

  if (!isBlockInstance(node)) {
    warn(
      context.seen,
      `shape:${String(index)}`,
      "A value in a blocks field is not a block instance. It is skipped.",
    );

    return null;
  }

  return renderInstance({ ...context, index, instance: node });
};

export interface ContentRendererProps {
  allowed?: BlockAllowedSpec;
  blocks?: null | readonly unknown[] | undefined;
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

  const context: RenderContext = {
    allowed,
    diagnose: shouldDiagnose(validate),
    fallback,
    registry: resolveBlockRegistry(registry),
    seen: isDevelopment() ? new Set<string>() : null,
  };

  return (
    <>
      {blocks.map((node, index) =>
        createElement(
          Fragment,
          { key: contentNodeKey(node, index) },
          renderNode({ ...context, index, nested: false, node }),
        ),
      )}
    </>
  );
};
