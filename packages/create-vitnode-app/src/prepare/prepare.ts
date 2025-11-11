import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const prepare = async () => {
  const toRootPaths = ["copy-of-vitnode-app", "copy-of-vitnode-plugin"];
  await Promise.all(
    toRootPaths.map(async path => {
      const toRootPath = join(process.cwd(), path);
      if (!existsSync(toRootPath)) {
        await mkdir(toRootPath);
      }
    }),
  );

  const fromRootPath = join(process.cwd(), "..", "..", "apps", "docs");
  if (!existsSync(fromRootPath)) {
    console.error(
      `\x1b[31mThe path ${fromRootPath} does not exist. Please check the directory structure.\x1b[0m`,
    );
    process.exit(1);
  }

  console.log(`Project path: ${fromRootPath}`);
};

void prepare();
