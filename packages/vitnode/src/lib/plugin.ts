export interface BuildPluginReturn<P extends string = string> {
  name: P;
}

export function buildPlugin<P extends string>(
  props: BuildPluginReturn<P>,
): BuildPluginReturn<P> {
  return props;
}
