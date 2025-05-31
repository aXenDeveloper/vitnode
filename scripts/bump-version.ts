/**
 * VitNode Bump Version Script
 *
 * This script handles version bumping and file synchronization for VitNode packages.
 * It copies files and folders from the main web app to the create-vitnode-app template
 * and manages package version updates across the workspace.
 */

import path from 'path';
import {
  existsSync,
  readFileSync,
  mkdirSync,
  copyFileSync,
  statSync,
  readdirSync,
} from 'fs';
import { execSync, spawn } from 'child_process';
import { EOL } from 'os';
import { FileSystem } from './files/file-system.ts';
import { FileCopyManager } from './files/file-copy-manager.ts';
import { VersionManager } from './version-manager.ts';
import { Environment } from './environment.ts';

// Constants
interface Config {
  ALLOWED_VERSION_TYPES: string[];
  PACKAGES_TO_BUMP: string[];
  TAG_PREFIX: string;
  TAG_SUFFIX: string;
  COMMIT_MESSAGE: string;
}

const CONFIG: Config = {
  ALLOWED_VERSION_TYPES: [
    'canary',
    'release-candidate',
    'major',
    'minor',
    'patch',
  ],
  PACKAGES_TO_BUMP: ['create-vitnode-app'],
  TAG_PREFIX: 'v',
  TAG_SUFFIX: '',
  COMMIT_MESSAGE: 'ci: version bump to {{version}}',
};

// Main execution
async function main(): Promise<void> {
  console.log('🚀 Starting VitNode version bump and file copy process...');
  const env = Environment.validate();

  const fileCopyManager = new FileCopyManager(env);
  await fileCopyManager.init();

  // const versionManager = new VersionManager(env);
  // await versionManager.init();

  console.log('✔ Process completed successfully! 🎉');
}

main().catch(error => {
  console.error('❌ Process failed:', error);
  process.exit(1);
});
