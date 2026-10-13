import type { ContentContainerTreeNode } from "@vitnode/core/content";

import type { Board } from "./boards-data";

import { boardHref } from "./board-search";
import { boardColor } from "./boards-data";

export const BoardColorDot = ({ board }: { board: Board }) => {
  const color = boardColor(board);

  return (
    <span
      aria-hidden="true"
      className={`size-3 shrink-0 rounded-full border${color === null ? " bg-muted" : ""}`}
      style={color === null ? undefined : { backgroundColor: color }}
    />
  );
};

const BoardTreeItems = ({
  nodes,
}: {
  nodes: ContentContainerTreeNode<Board>[];
}) => (
  <ul className="flex flex-col gap-2">
    {nodes.map(node => (
      <li className="flex flex-col gap-2" key={node.id}>
        <a
          className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring flex flex-col gap-1 rounded-lg border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          href={boardHref(node.slug)}
        >
          <span className="text-foreground flex items-center gap-2 font-medium text-balance">
            <BoardColorDot board={node} />
            {node.name}
          </span>
          {node.metadata.description ? (
            <span className="text-muted-foreground text-sm leading-relaxed text-pretty">
              {node.metadata.description}
            </span>
          ) : null}
        </a>

        {node.children.length > 0 ? (
          <div className="border-l pl-4 md:pl-6">
            <BoardTreeItems nodes={node.children} />
          </div>
        ) : null}
      </li>
    ))}
  </ul>
);

export const BoardTree = ({
  label,
  nodes,
}: {
  label: string;
  nodes: ContentContainerTreeNode<Board>[];
}) => (
  <nav aria-label={label}>
    <BoardTreeItems nodes={nodes} />
  </nav>
);
