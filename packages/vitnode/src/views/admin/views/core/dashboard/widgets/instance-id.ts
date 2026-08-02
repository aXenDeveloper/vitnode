const SUFFIX = "#";

export const widgetIdOf = (instanceId: string): string => {
  const at = instanceId.indexOf(SUFFIX);

  return at === -1 ? instanceId : instanceId.slice(0, at);
};

export const isInstanceOf = (instanceId: string, widgetId: string): boolean =>
  widgetIdOf(instanceId) === widgetId;

export const nextInstanceId = (
  widgetId: string,
  taken: Iterable<string>,
): string => {
  const used = new Set(taken);
  if (!used.has(widgetId)) return widgetId;

  for (let n = 2; n <= used.size + 2; n++) {
    const candidate = `${widgetId}${SUFFIX}${n}`;
    if (!used.has(candidate)) return candidate;
  }

  // Unreachable: the loop tries more candidates than there are taken ids.
  throw new Error(`No instance id left for ${widgetId}`);
};
