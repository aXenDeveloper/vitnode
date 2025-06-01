export interface BuildPluginReturn<P extends string = string> {
  adminNav?: {
    label: string;
  }[];
  id: P;
}

export function buildPlugin<P extends string>(
  props: BuildPluginReturn<P>,
): BuildPluginReturn<P> {
  return props;
}
