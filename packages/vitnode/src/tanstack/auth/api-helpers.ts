export const callUsersApi = async <TResponse>(
  call: () => Promise<TResponse>,
): Promise<null | TResponse> => {
  try {
    return await call();
  } catch (error) {
    // oxlint-disable-next-line no-console
    console.error("[auth] users API call failed", error);

    return null;
  }
};

export const readJson = async (response: {
  json: () => Promise<unknown>;
}): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
};

export const readText = async (response: {
  text: () => Promise<string>;
}): Promise<string> => {
  try {
    return await response.text();
  } catch {
    return "";
  }
};
