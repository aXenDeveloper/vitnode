export interface PackageJSON {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  exports?: Record<string, Record<string, string>>;
  name: string;
  overrides?: Record<string, string>;
  packageManager?: string;
  pnpm?: Record<string, Record<string, string>>;
  private: boolean;
  scripts?: Record<string, string>;
  type?: string;
  version: string;
  workspaces?: string[];
}
