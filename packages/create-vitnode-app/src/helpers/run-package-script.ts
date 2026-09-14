import { spawnCommand } from "./spawn-command.js";

export const runPackageScript = async ({
  cwd,
  packageManager,
  script,
}: {
  cwd: string;
  packageManager: string;
  script: string;
}): Promise<{ ok: false; output: string } | { ok: true }> =>
  await new Promise(resolve => {
    const child = spawnCommand(packageManager.split("@")[0], ["run", script], {
      cwd,
      env: { ...process.env, NODE_ENV: "development" },
      stdio: "pipe",
    });
    let output = "";

    child.stdout?.on("data", (data: Buffer) => {
      output += data.toString();
    });
    child.stderr?.on("data", (data: Buffer) => {
      output += data.toString();
    });

    child.on("close", code => {
      resolve(code === 0 ? { ok: true } : { ok: false, output });
    });
    child.on("error", (error: Error) => {
      resolve({ ok: false, output: error.message });
    });
  });
