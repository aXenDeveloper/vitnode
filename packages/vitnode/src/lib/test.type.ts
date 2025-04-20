// type PathToChain<
//   Path extends string,
//   E extends Schema,
//   Original extends string = Path,
// > = Path extends `/${infer P}`
//   ? PathToChain<P, E, Original> // Pass Original consistently
//   : Path extends `${infer P}/${infer R}`
//     ? { [K in P]: PathToChain<R, E, Original> }
//     : Record<
//         Path extends '' ? 'index' : Path,
//         ClientRequest<E extends Record<string, unknown> ? E[Original] : never>
//       >;
