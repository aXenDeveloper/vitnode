const MAX_URL_LENGTH = 2048;

export const isHttpsUrl = (value: string): boolean => {
  if (value.length > MAX_URL_LENGTH) return false;

  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      url.hostname !== "" &&
      url.username === "" &&
      url.password === ""
    );
  } catch {
    return false;
  }
};

/**
 * Where a package publishes its update manifest. Public by definition - it
 * ends up in generated browser metadata - so nothing that looks like a
 * credential is accepted: no user info, no query string, no fragment.
 */
export const updateSourceUrlProblem = (value: string): null | string => {
  if (!isHttpsUrl(value)) {
    return "has to be an absolute https:// URL without a user name or password";
  }

  const url = new URL(value);
  if (url.search !== "" || url.hash !== "") {
    return "cannot carry a query string or fragment - an update manifest is public, so it needs no token";
  }

  return null;
};
