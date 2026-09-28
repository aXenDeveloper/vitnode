import type { CSSProperties, ReactElement } from "react";

import { createElement, useCallback, useState } from "react";

import type { ContentEditRuntime, ContentZoneMount } from "./edit-context";

import { sameContentZoneMount } from "./edit-context";
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
  const [registeredMount, setRegisteredMount] = useState(mount);

  if (
    registeredMount !== mount &&
    !sameContentZoneMount(registeredMount, mount)
  ) {
    setRegisteredMount(mount);
  }

  const register = useCallback(
    (node: HTMLElement) => {
      runtime.registerZone({ mount: registeredMount, node });

      return () => {
        runtime.releaseZone({ id: registeredMount.id, node });
      };
    },
    [registeredMount, runtime],
  );

  const transparent =
    runtime.preview && mount.as === undefined && mount.className === undefined;

  return createElement(mount.as ?? "div", {
    ...contentZoneAttributes({
      allowedBlocks: mount.allowedBlocks,
      id: mount.id,
    }),
    className: mount.className,
    ref: register,
    style: transparent ? CONTENTS : undefined,
  });
};
