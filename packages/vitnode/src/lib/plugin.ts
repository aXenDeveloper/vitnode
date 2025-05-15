export interface BuildPluginReturn<P extends string = string> {
  name: P;
  pages?: () => React.ReactNode;
}

export function buildPlugin<P extends string>({
  name,
  pages,
}: BuildPluginReturn<P>): BuildPluginReturn<P> {
  return { name, pages };
}
