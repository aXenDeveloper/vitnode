import { spawn } from "node:child_process";

export const runInteractiveShellCommand = async (
  cmd: string,
  args: string[] = [],
) => {
  return await new Promise((resolve, reject) => {
    const child = spawn([cmd, ...args].join(" "), {
      stdio: "inherit",
      shell: true,
      env: process.env,
    });

    child.on("error", error => {
      reject(error);
    });

    child.on("close", code => {
      if (code !== 0) {
        reject(new Error(`Command failed with exit code ${code}`));
      } else {
        resolve(true);
      }
    });
  });
};
