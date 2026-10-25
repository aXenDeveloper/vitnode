import type { ContentContainerTreeNode } from "@vitnode/core/content";

import { HrefLink } from "@vitnode/core/tanstack/link";

import type { Desk } from "./desks-data";

import { deskHref } from "./desk-search";
import { deskColor } from "./desks-data";

export const DeskColorDot = ({ desk }: { desk: Desk }) => {
  const color = deskColor(desk);

  return (
    <span
      aria-hidden="true"
      className={`size-3 shrink-0 rounded-full border${color === null ? " bg-muted" : ""}`}
      style={color === null ? undefined : { backgroundColor: color }}
    />
  );
};

const DeskTreeItems = ({
  nodes,
}: {
  nodes: ContentContainerTreeNode<Desk>[];
}) => (
  <ul className="flex flex-col gap-2">
    {nodes.map(node => (
      <li className="flex flex-col gap-2" key={node.id}>
        <HrefLink
          className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring flex flex-col gap-1 rounded-lg border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          href={deskHref(node.slug)}
        >
          <span className="text-foreground flex items-center gap-2 font-medium text-balance">
            <DeskColorDot desk={node} />
            {node.name}
          </span>
          {node.metadata.description ? (
            <span className="text-muted-foreground text-sm leading-relaxed text-pretty">
              {node.metadata.description}
            </span>
          ) : null}
        </HrefLink>

        {node.children.length > 0 ? (
          <div className="border-l pl-4 md:pl-6">
            <DeskTreeItems nodes={node.children} />
          </div>
        ) : null}
      </li>
    ))}
  </ul>
);

export const DeskTree = ({
  label,
  nodes,
}: {
  label: string;
  nodes: ContentContainerTreeNode<Desk>[];
}) => (
  <nav aria-label={label}>
    <DeskTreeItems nodes={nodes} />
  </nav>
);
