const postgresCodeOf = (error: unknown): string | undefined => {
  let current: unknown = error;

  for (let depth = 0; depth < 4 && current; depth++) {
    if (typeof current === "object" && "code" in current) {
      const { code } = current;
      if (typeof code === "string") return code;
    }

    current =
      typeof current === "object" && "cause" in current
        ? current.cause
        : undefined;
  }

  return undefined;
};

export const isUniqueViolation = (error: unknown): boolean =>
  postgresCodeOf(error) === "23505";

export const isForeignKeyViolation = (error: unknown): boolean =>
  postgresCodeOf(error) === "23503";
