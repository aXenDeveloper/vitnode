export interface PackageJSON {
  dependencies?: Record<string, string>;
  description?: string;
  devDependencies?: Record<string, string>;
  engines?: Record<string, string>;

  exports?: Record<string, Record<string, string> | string>;
  name: string;
  overrides?: Record<string, string>;
  packageManager?: string;
  pnpm?: Record<string, Record<string, string>>;
  private: boolean;
  scripts?: Record<string, string>;
  type?: string;
  version?: string;
  /** What AdminCP → System → Plugins shows for a plugin package. */
  vitnode?: { icon?: string; title?: string };
  workspaces?: string[];
}
