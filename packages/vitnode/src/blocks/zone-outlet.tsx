import type { CSSProperties, ReactElement } from "react";

import { createElement, useEffect, useState } from "react";

import type { ContentEditRuntime, ContentZoneMount } from "./edit-context";

import { contentZoneAttributes } from "./zone-meta";

const CONTENTS: CSSProperties = { display: "contents" };

export interface ContentZoneOutletProps {
  mount: ContentZoneMount;
  runtime: ContentEditRuntime;
}

export const ContentZoneOutlet = ({
  mount,
  runtime,
}: ContentZoneOutletProps): ReactElement => {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const { id } = mount;

  useEffect(() => {
    if (node) runtime.registerZone({ mount, node });
  }, [mount, node, runtime]);

  useEffect(() => {
    if (!node) return;

    return () => {
      runtime.releaseZone({ id, node });
    };
  }, [id, node, runtime]);

  const transparent =
    runtime.preview && mount.as === undefined && mount.className === undefined;

  return createElement(mount.as ?? "div", {
    ...contentZoneAttributes({
      allowedBlocks: mount.allowedBlocks,
      id: mount.id,
    }),
    className: mount.className,
    ref: setNode,
    style: transparent ? CONTENTS : undefined,
  });
};
