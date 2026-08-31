export interface PackageJSON {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  /**
   * A subpath value is either a conditions object or a plain target.
   *
   * Both, because a VitNode plugin needs both: `"./*"` maps to build output
   * under `import`/`types`/`default`, and `"./locales/*.json"` maps straight to
   * a file, since a wildcard that appends `.js` cannot answer a `.json`
   * subpath. Typed as only the first, a plugin's messages had nowhere to go.
   */
  exports?: Record<string, Record<string, string> | string>;
  name: string;
  overrides?: Record<string, string>;
  packageManager?: string;
  pnpm?: Record<string, Record<string, string>>;
  private: boolean;
  scripts?: Record<string, string>;
  type?: string;
  version?: string;
  workspaces?: string[];
}
