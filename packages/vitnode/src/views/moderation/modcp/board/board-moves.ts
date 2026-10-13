import type { ModcpBoardReport, ModcpBoardStatus } from "../modcp-query";

export type BoardPerson = NonNullable<ModcpBoardReport["assignee"]>;

export interface BoardOverride {
  assignee: BoardPerson | null;
  status: ModcpBoardStatus;
}

export type BoardMove =
  | { kind: "claim" }
  | { kind: "reopen"; to: Exclude<ModcpBoardStatus, "done"> }
  | { kind: "resolve" }
  | { kind: "unassign" };

export const planBoardMove = (
  from: ModcpBoardStatus,
  to: ModcpBoardStatus,
): BoardMove | null => {
  if (from === to) return null;
  if (to === "done") return { kind: "resolve" };
  if (from === "done") return { kind: "reopen", to };

  return to === "in_progress" ? { kind: "claim" } : { kind: "unassign" };
};

export const optimisticOverride = ({
  me,
  row,
  to,
}: {
  me: BoardPerson;
  row: ModcpBoardReport;
  to: ModcpBoardStatus;
}): BoardOverride => ({
  assignee: to === "new" ? null : (row.assignee ?? me),
  status: to,
});

const timeOf = (value: Date | string): number => new Date(value).getTime();

export const newestFirst = (
  left: Pick<ModcpBoardReport, "createdAt" | "id">,
  right: Pick<ModcpBoardReport, "createdAt" | "id">,
): number =>
  timeOf(right.createdAt) - timeOf(left.createdAt) || right.id - left.id;

export type BoardColumns = Record<ModcpBoardStatus, ModcpBoardReport[]>;

export const boardColumns = ({
  loaded,
  overrides,
}: {
  loaded: BoardColumns;
  overrides: ReadonlyMap<number, BoardOverride>;
}): BoardColumns => {
  const latest = new Map<number, ModcpBoardReport>();
  for (const row of [...loaded.new, ...loaded.in_progress, ...loaded.done]) {
    const known = latest.get(row.id);
    if (!known || row.version > known.version) latest.set(row.id, row);
  }

  const columns: BoardColumns = { done: [], in_progress: [], new: [] };
  for (const row of latest.values()) {
    const override = overrides.get(row.id);
    const shown = override ? { ...row, ...override } : row;
    columns[shown.status].push(shown);
  }

  for (const rows of Object.values(columns)) rows.sort(newestFirst);

  return columns;
};

export const columnCount = ({
  loaded,
  overrides,
  status,
  total,
}: {
  loaded: BoardColumns;
  overrides: ReadonlyMap<number, BoardOverride>;
  status: ModcpBoardStatus;
  total: number;
}): number => {
  let count = total;
  for (const row of [...loaded.new, ...loaded.in_progress, ...loaded.done]) {
    const override = overrides.get(row.id);
    if (!override || override.status === row.status) continue;
    if (override.status === status) count += 1;
    if (row.status === status) count -= 1;
  }

  return Math.max(0, count);
};

export const slotIndex = (
  rows: readonly ModcpBoardReport[],
  dragged: Pick<ModcpBoardReport, "createdAt" | "id">,
): number => {
  const index = rows.findIndex(row => newestFirst(dragged, row) < 0);

  return index === -1 ? rows.length : index;
};
