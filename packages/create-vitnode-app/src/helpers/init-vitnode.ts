import { spawn } from "node:child_process";

import type { CreateCliReturn } from "../questions.js";

export const initFilesVitnode = ({
  packageManager: pm,
  cwd,
  flag,
}: Pick<CreateCliReturn, "packageManager"> & {
  cwd?: string;
  flag?: "api" | "web";
}) => {
  const packageManager = pm.split("@")[0];
  const args: string[] = [
    "vitnode",
    "prepare-plugins",
    flag ? `--${flag}` : "",
  ];

  spawn(packageManager, args, {
    cwd,
    shell: true,
  });
};

export const generateMigrationsVitnode = ({
  packageManager: pm,
  cwd,
}: Pick<CreateCliReturn, "packageManager"> & { cwd?: string }) => {
  const packageManager = pm.split("@")[0];
  const args: string[] = ["vitnode", "migrate", "--generate"];

  spawn(packageManager, args, {
    cwd,
    shell: true, // Use shell to properly handle Windows batch files
  });
};
