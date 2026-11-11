interface Op {
  kind: " " | "+" | "-";
  line: string;
}

const MAX_CELLS = 4_000_000;

const splitLines = (text: string): string[] => {
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();

  return lines;
};

const diffLines = (a: readonly string[], b: readonly string[]): Op[] => {
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head += 1;
  let tail = 0;
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    a[a.length - 1 - tail] === b[b.length - 1 - tail]
  ) {
    tail += 1;
  }

  const midA = a.slice(head, a.length - tail);
  const midB = b.slice(head, b.length - tail);
  const ops: Op[] = a.slice(0, head).map(line => ({ kind: " ", line }));

  if ((midA.length + 1) * (midB.length + 1) > MAX_CELLS) {
    ops.push(...midA.map(line => ({ kind: "-" as const, line })));
    ops.push(...midB.map(line => ({ kind: "+" as const, line })));
  } else {
    const width = midB.length + 1;
    const table = new Uint32Array((midA.length + 1) * width);
    for (let i = midA.length - 1; i >= 0; i -= 1) {
      for (let j = midB.length - 1; j >= 0; j -= 1) {
        table[i * width + j] =
          midA[i] === midB[j]
            ? (table[(i + 1) * width + j + 1] ?? 0) + 1
            : Math.max(
                table[(i + 1) * width + j] ?? 0,
                table[i * width + j + 1] ?? 0,
              );
      }
    }

    let i = 0;
    let j = 0;
    while (i < midA.length && j < midB.length) {
      if (midA[i] === midB[j]) {
        ops.push({ kind: " ", line: midA[i] ?? "" });
        i += 1;
        j += 1;
      } else if (
        (table[(i + 1) * width + j] ?? 0) >= (table[i * width + j + 1] ?? 0)
      ) {
        ops.push({ kind: "-", line: midA[i] ?? "" });
        i += 1;
      } else {
        ops.push({ kind: "+", line: midB[j] ?? "" });
        j += 1;
      }
    }
    while (i < midA.length) ops.push({ kind: "-", line: midA[i++] ?? "" });
    while (j < midB.length) ops.push({ kind: "+", line: midB[j++] ?? "" });
  }

  ops.push(
    ...a.slice(a.length - tail).map(line => ({ kind: " " as const, line })),
  );

  return ops;
};

export const unifiedDiff = (
  path: string,
  before: null | string,
  after: string,
  context = 3,
): string[] => {
  const ops = diffLines(splitLines(before ?? ""), splitLines(after));
  const out = [
    `--- ${before === null ? "/dev/null" : `a/${path}`}`,
    `+++ b/${path}`,
  ];

  const changed = ops.flatMap((op, index) => (op.kind === " " ? [] : [index]));
  if (changed.length === 0) return out;

  const hunks: [number, number][] = [];
  for (const index of changed) {
    const start = Math.max(0, index - context);
    const end = Math.min(ops.length, index + context + 1);
    const last = hunks[hunks.length - 1];
    if (last !== undefined && start <= last[1])
      last[1] = Math.max(last[1], end);
    else hunks.push([start, end]);
  }

  for (const [start, end] of hunks) {
    let oldLine = 1;
    let newLine = 1;
    for (const op of ops.slice(0, start)) {
      if (op.kind !== "+") oldLine += 1;
      if (op.kind !== "-") newLine += 1;
    }
    const slice = ops.slice(start, end);
    const oldCount = slice.filter(op => op.kind !== "+").length;
    const newCount = slice.filter(op => op.kind !== "-").length;

    out.push(
      `@@ -${String(oldCount === 0 ? oldLine - 1 : oldLine)},${String(oldCount)} +${String(newCount === 0 ? newLine - 1 : newLine)},${String(newCount)} @@`,
    );
    out.push(...slice.map(op => `${op.kind}${op.line}`));
  }

  return out;
};
