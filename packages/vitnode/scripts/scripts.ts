#!/usr/bin/env node
import { config } from "dotenv";

import { runCli } from "./cli/index.js";
import { readCliVersion } from "./cli/version.js";

config({ quiet: true });

const code = await runCli(process.argv.slice(2), {
  cwd: process.cwd(),
  env: process.env,
  platform: process.platform,
  signals: process,
  // The CLI keeps its own handle on the real `write`: a build temporarily
  // redirects `process.stdout` to hold back noisy plugin output, and the
  // progress lines must keep reaching the terminal while it does.
  stderr: {
    isTTY: process.stderr.isTTY,
    write: process.stderr.write.bind(process.stderr),
  },
  stdin: process.stdin,
  stdout: {
    get columns() {
      return process.stdout.columns;
    },
    isTTY: process.stdout.isTTY,
    write: process.stdout.write.bind(process.stdout),
  },
  version: readCliVersion(),
});

// Exit explicitly - a database client or a file watcher left open by a
// command must not keep the process alive - but only once stdout has drained,
// so piped output is never cut short.
process.stdout.write("", () => {
  process.exit(code);
});
