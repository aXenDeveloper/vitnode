import type { ReactElement } from "react";

import { createElement } from "react";

import type { AnyBlockInstance, RegisteredBlock } from "../../blocks/types";

import {
  InvalidBlock,
  UnknownBlock,
  UnknownVariantBlock,
} from "./block-placeholder";
import { editableBlockRender } from "./block-render";

interface EditableBlockBodyProps {
  entry: RegisteredBlock | undefined;
  index: number;
  instance: AnyBlockInstance;
}

export const EditableBlockBody = ({
  entry,
  index,
  instance,
}: EditableBlockBodyProps): ReactElement => {
  const render = editableBlockRender({ entry, instance });

  if (render.kind === "unknown-type") {
    return <UnknownBlock type={instance.type} />;
  }

  if (render.kind === "unknown-variant") {
    return <UnknownVariantBlock variant={render.variant} />;
  }

  if (render.kind === "invalid-data") {
    return (
      <InvalidBlock
        detail={render.detail}
        name={entry?.definition.name ?? instance.type}
      />
    );
  }

  return createElement(render.entry.definition.component, {
    blockId: instance.id,
    data: instance.data,
    index,
    type: instance.type,
    variant: render.variant,
  });
};
