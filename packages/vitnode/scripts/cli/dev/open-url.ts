import { spawn } from "node:child_process";

/**
 * Opens a URL in the default browser, without a shell.
 *
 * `rundll32 url.dll,FileProtocolHandler` is how Windows opens a URL without
 * `cmd /c start`, whose quoting rules are a trap for anything with `&` in it.
 */
export const openUrl = (url: string, platform: NodeJS.Platform): void => {
  const [command, args] =
    platform === "darwin"
      ? ["open", [url]]
      : platform === "win32"
        ? ["rundll32", ["url.dll,FileProtocolHandler", url]]
        : ["xdg-open", [url]];

  const child = spawn(command, args, {
    detached: true,
    shell: false,
    stdio: "ignore",
  });
  child.on("error", () => undefined);
  child.unref();
};
