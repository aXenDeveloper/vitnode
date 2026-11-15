export type VitNodeSocketUserId = null | number;

export const shouldReconnectForUser = (
  previous: undefined | VitNodeSocketUserId,
  next: undefined | VitNodeSocketUserId,
): boolean => {
  if (next === undefined || previous === undefined) return false;

  return previous !== next;
};
