import type { ReactElement } from "react";

import { BlocksIcon } from "lucide-react";

import type { BlockIcon } from "../../blocks/types";

export const BlockGlyph = ({
  icon: Icon = BlocksIcon,
}: {
  icon: BlockIcon | undefined;
}): ReactElement => <Icon />;
