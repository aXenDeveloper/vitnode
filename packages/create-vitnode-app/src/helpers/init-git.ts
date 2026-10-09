import { rm } from "node:fs/promises";
import { join } from "node:path";

import { spawnCommand } from "./spawn-command.js";

export type InitGitResult =
  | "already-in-repository"
  | "created"
  | "failed"
  | "git-unavailable";

export const DEFAULT_GIT_BRANCH = "main";

const runGit = async (args: string[], cwd: string): Promise<boolean> =>
  new Promise<boolean>(resolve => {
    const child = spawnCommand("git", args, { cwd, stdio: "ignore" });

    child.on("error", () => {
      resolve(false);
    });
    child.on("close", code => {
      resolve(code === 0);
    });
  });

export const initGitRepository = async ({
  root,
  branch = DEFAULT_GIT_BRANCH,
  commitMessage = "Initial commit from Create VitNode App",
}: {
  branch?: string;
  commitMessage?: string;
  root: string;
}): Promise<InitGitResult> => {
  if (!(await runGit(["--version"], root))) {
    return "git-unavailable";
  }

  if (await runGit(["rev-parse", "--is-inside-work-tree"], root)) {
    return "already-in-repository";
  }

  const removeGitDirectory = async () => {
    await rm(join(root, ".git"), { force: true, recursive: true });
  };

  const initialized =
    (await runGit(["init", "--initial-branch", branch], root)) ||
    ((await runGit(["init"], root)) &&
      (await runGit(["symbolic-ref", "HEAD", `refs/heads/${branch}`], root)));

  if (!initialized) {
    await removeGitDirectory();

    return "failed";
  }

  const committed =
    (await runGit(["add", "-A"], root)) &&
    (await runGit(["commit", "-m", commitMessage], root));

  if (!committed) {
    await removeGitDirectory();

    return "failed";
  }

  return "created";
};
