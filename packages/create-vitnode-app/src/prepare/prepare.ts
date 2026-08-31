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

  // A layout sanity check, and nothing more: the path is checked, logged and
  // dropped. What `create-vitnode-app` actually scaffolds from is the committed
  // `copy-of-vitnode-app/` tree above, not a live application - so this exists
  // only to fail loudly when the script is run from somewhere other than the
  // package directory inside the monorepo.
  //
  // It named `apps/docs` until Stage 17 deleted that application, at which point
  // a check that copies nothing was failing the whole build. `apps/web` is the
  // reference application now.
  const fromRootPath = join(process.cwd(), "..", "..", "apps", "web");
  if (!existsSync(fromRootPath)) {
    console.error(
      `\x1b[31mThe path ${fromRootPath} does not exist. Please check the directory structure.\x1b[0m`,
    );
    process.exit(1);
  }

  console.log(`Project path: ${fromRootPath}`);
};

void prepare();
