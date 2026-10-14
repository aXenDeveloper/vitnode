import { createServerEntry } from "@tanstack/react-start/server";

export const runInStartRequest = async (
  url: string,
  run: () => Promise<void>,
): Promise<void> => {
  let outcome: Promise<void> = Promise.resolve();

  await createServerEntry({
    fetch: async () => {
      outcome = run();
      await outcome.catch(() => undefined);

      return new Response(null, { status: 204 });
    },
  }).fetch(new Request(url));

  await outcome;
};
