export const withIf = <T extends Record<string, string>>(
  cond: boolean,
  obj: T,
) => (cond ? obj : {}) as Partial<T>;
