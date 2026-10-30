export const errorCodeOf = async (
  response: Response,
): Promise<string | undefined> => {
  try {
    const body: unknown = await response.json();

    return typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
      ? body.error
      : undefined;
  } catch {
    return undefined;
  }
};
