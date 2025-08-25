/**
 * VitNode Bump Version Script
 *
 * This script handles version bumping and file synchronization for VitNode packages.
 * It copies files and folders from the main web app to the create-vitnode-app template
 * and manages package version updates across the workspace.
 */
/** biome-ignore-all lint/suspicious/noConsole: <No need this> */

import { Environment } from "./environment.ts";
import { FileCopyManager } from "./files/file-copy-manager.ts";
import { VersionManager } from "./version-manager.ts";

// Main execution
async function main(): Promise<void> {
  console.log("🚀 Starting VitNode version bump and file copy process...");
  const env = Environment.validate();

  const fileCopyManager = new FileCopyManager(env);
  await fileCopyManager.init();

  const versionManager = new VersionManager(env);
  await versionManager.init();

  console.log("✔ Process completed successfully! 🎉");
}

main().catch(error => {
  console.error("❌ Process failed:", error);
  process.exit(1);
});
