export interface AdminMutationError {
  message?: string;
  status: number;
}

export type AdminMutationResult<TData> =
  { data: TData } | { error: AdminMutationError };

/** A thrown `500`, an unreachable API, and a rejected fetch all land here. */
export const ADMIN_MUTATION_UNREACHABLE = 500;

export const isAdminMutationError = <TData>(
  result: AdminMutationResult<TData>,
): result is { error: AdminMutationError } => "error" in result;

const readErrorMessage = async (
  response: Response,
): Promise<string | undefined> => {
  try {
    const text = await response.text();

    return text.trim() === "" ? undefined : text;
  } catch {
    return undefined;
  }
};

export const runAdminApiMutation = async <TData>({
  expected,
  parse,
  request,
}: {
  expected: number;

  parse: (response: Response) => Promise<TData> | TData;
  request: () => Promise<Response>;
}): Promise<AdminMutationResult<TData>> => {
  try {
    const response = await request();
    if (response.status !== expected) {
      return {
        error: {
          message: await readErrorMessage(response),
          status: response.status,
        },
      };
    }

    return { data: await parse(response) };
  } catch (error) {
    // The one place a caller cannot see: the status it gets back says only
    // "unreachable", and this is what says *why*.
    // eslint-disable-next-line no-console
    console.error("[admin] a mutation could not be sent", error);

    return { error: { status: ADMIN_MUTATION_UNREACHABLE } };
  }
};
