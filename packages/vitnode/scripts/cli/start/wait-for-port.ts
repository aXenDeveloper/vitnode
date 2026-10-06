import { connect } from "node:net";

const canConnect = async (port: number, host: string): Promise<boolean> =>
  new Promise(resolve => {
    const socket = connect({ host, port });
    const done = (result: boolean) => {
      socket.destroy();
      resolve(result);
    };

    socket.once("connect", () => {
      done(true);
    });
    socket.once("error", () => {
      done(false);
    });
    socket.setTimeout(1000, () => {
      done(false);
    });
  });

/**
 * Resolves `true` once something accepts connections on the port, `false` when
 * `isAlive` says the server is gone or the timeout passes first.
 *
 * "Running" is printed only after this - a server that crashed during boot
 * must not have been announced as up.
 */
export const waitForPort = async ({
  host,
  isAlive,
  port,
  timeoutMs = 60_000,
}: {
  host: string;
  isAlive: () => boolean;
  port: number;
  timeoutMs?: number;
}): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline && isAlive()) {
    if (await canConnect(port, host)) return true;
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return false;
};
