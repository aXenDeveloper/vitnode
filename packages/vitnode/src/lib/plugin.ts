interface Pages {
  component: (args: {
    locale: string;
    params: string[];
    searchParams: Promise<Record<string, string>>;
  }) => React.ReactNode | undefined;
  staticPaths?: string[];
}

export interface BuildPluginReturn<P extends string = string> {
  adminPages?: Pages;
  name: P;
  pages?: Pages;
}

export function buildPlugin<P extends string>(
  props: BuildPluginReturn<P>,
): BuildPluginReturn<P> {
  return props;
}
