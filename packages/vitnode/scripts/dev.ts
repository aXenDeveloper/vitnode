/* eslint-disable no-console */
import { spawn } from "node:child_process";

const spawnWatch = (command: string, args: string[]) => {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });

  child.on("error", error => {
    console.error(`\x1b[31m${command} failed:\x1b[0m`, error);
  });

  child.on("exit", code => {
    if (code !== null && code !== 0) {
      console.error(`\x1b[31m${command} exited with code ${code}\x1b[0m`);
    }
  });

  return child;
};

/**
 * `vitnode dev` - a plugin's own build, in watch mode.
 *
 * Three compilers over the plugin's `src/`, and nothing else. Until the Next.js
 * cutover this also started a chokidar watcher that copied the plugin's
 * `src/routes/{main,admin,blank,breadcrumb}/` into every Next.js app's
 * `src/app/[locale]/…` on every save, rewriting each import as it went - so a
 * plugin page existed twice and the copy was the one that ran.
 *
 * An app now reads a plugin's routes out of its `dist` through the generated
 * route registry, which is why watching `dist` is the whole job: `swc -w`
 * writes the page, the app's Vite server sees the file it already imports
 * change, and the page reloads. Nothing is copied and nothing has to be cleaned
 * up when a route file is deleted.
 */
export const devPlugin = ({ initMessage }: { initMessage: string }) => {
  const children = [
    spawnWatch("tsc", [
      "-w",
      "-p",
      "tsconfig.build.json",
      "--preserveWatchOutput",
    ]),
    spawnWatch("swc", [
      "src",
      "-d",
      "dist",
      "--config-file",
      ".swcrc",
      // Keeps locale JSON in `dist` alongside the compiled barrel.
      "--copy-files",
      "-w",
    ]),
    spawnWatch("tsc-alias", ["-w", "-p", "tsconfig.build.json"]),
  ];

  const shutdown = () => {
    children.forEach(child => child.kill());
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log(`${initMessage} \x1b[34mWatching plugin sources...\x1b[0m`);
};
